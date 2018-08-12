let csvLocation = ('./output/');
const csvFilePath = csvLocation+'The Book Thief.txt';

var fs = require('fs');

var Dictionary = require("oxford-dictionary");

let cachedDictionary = './cached-words.json';
let cachedDictionaryJSON = require(cachedDictionary);

var config = {
    app_id : "b1050aac",
    app_key : "106b243233852512b578d7e2dfb84b29",
    source_lang : "en"
};
var dict = new Dictionary(config);



async function readLines(input) {
    return new Promise(resolve =>{
        let allWords = [];
        var remaining = '';
    
      input.on('data', function(data) {
          console.log('a');
        remaining += data;
        var index = remaining.indexOf('\n');
        while (index > -1) {
          var line = remaining.substring(0, index);
          remaining = remaining.substring(index + 1);
          line = line.replace(/\t/g, '').trim();
          allWords.push(line);
          index = remaining.indexOf('\n');
        }
      });
    
      input.on('end', function() {
        if (remaining.length > 0) {
            remaining = remaining.replace(/\t/g, '').trim();
            allWords.push(remaining);
        }
        resolve(allWords);
      });
    });
}

async function main() {
    //get all lines from the parsed kindle entry
    console.log('getting words from kindle');
    var input = fs.createReadStream(csvFilePath);
    let parsedWords = await readLines(input);

    console.log('converting each word to an object');
    //parse each word as an object
    let allWords = parseAllLines(parsedWords);

    //console.log(JSON.stringify(allWords,null,4));
    //for each word, check get the entry
    console.log('Looking up the defintions');
    allWords = getAllDefinitions(allWords);

    
    //convert entries suited to ANKI

    //write final output.txt

    //handle empty entries - add it as unknown and you can optianlly paste in a meaning or hit enter to continue.
};
main();


async function getAllDefinitions(words) {
    for(const word of Object.keys(words)){
        let definition =  await lookupDefinition(word);
        console.log('defintiion for: ' + word);
        console.log(JSON.stringify(definition));
        word.definition = definition;
    }

    return words;
}

async function lookupDefinition(word){
    let definition;
    // console.log('lookg up : ' + word);
    //check if it exists in the local dictionary first.
    let localEntry = await lookupEntryInCachedDictionary(word);

    // console.log('local entry ' + localEntry);

    if(localEntry){
        // console.log('local entry found');
        definition = localEntry;
    } else {
        //look up online
        // console.log('local entry NOT found, searching online');
        definition = await getDefinition(word);
        // console.log('got response online: ' + JSON.stringify(definition));

        //TODO add to local dictionary
        cachedDictionaryJSON[word] = definition;
        // console.log('cached dictionary now');
        // console.log(JSON.stringify(cachedDictionaryJSON,null,4));
        await writeCachedDictionary(cachedDictionaryJSON);
    }
    return definition;
};

async function writeCachedDictionary(inputJSON){
    return new Promise(resolve=>{
        fs.writeFile(cachedDictionary, JSON.stringify(inputJSON,null,4), (err) => {  
            // console.log('file wrote');
            if (err) throw err;
            resolve();
        });
    });
}

async function getDefinition(inputWord){
    return new Promise(resolve=>{
        setTimeout(async function(){
            let lookup;
            try {
                lookup = await dict.find(inputWord);
            } catch(err) {
                console.log("Dictionary Error Lookin up " + inputWord);
                console.log(err);
                //todo add option for manual entry
                lookup = {
                    definition:'unknown'
                }
            }
            resolve(lookup);
        },1010);
    });
}

function parseAllLines(allWords){
    let allLines = {};
    allWords.forEach(line => {
        let currentLine = parseLine(line);
        let key = currentLine.word;
        allLines[key] = currentLine;
    });
    return allLines;
}


async function lookupEntryInCachedDictionary(word){
    // // console.log(JSON.stringify(cachedDictionaryJSON,null,4));
    // console.log('looking up ' + word);
    // console.log(cachedDictionaryJSON.hasOwnProperty(word));
    return new Promise(resolve =>{
        if(cachedDictionaryJSON.hasOwnProperty(word)){
            return resolve(cachedDictionaryJSON[word]);
        }else{
            return resolve(null);
        }
    });
}

function parseLine(inputLine){
    let data = inputLine.split(',,,');
    let tempEntry = {
        stem:data[0],
        word:data[1],
        usage:data[2]
    };
    return tempEntry;
}