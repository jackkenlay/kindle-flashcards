let csvLocation = ('./output/');
const csvFilePath = csvLocation+'Undisputed Truth: My Autobiography.txt';

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
    allWords = await getAllDefinitions(allWords);

    // console.log('all words' + JSON.stringify(allWords));
    
    //convert entries suited to ANKI
    await createAnkiDeck(allWords,'output.csv');
    //write final output.txt

    
    //handle empty entries - add it as unknown and you can optianlly paste in a meaning or hit enter to continue.
};
main();

async function createAnkiDeck(entries, filename){
    let allCards = [];
    Object.keys(entries).forEach(entry =>{
        console.log('making card for first word: ' + entry);

        let fullEntry = entries[entry];

        let card = createAnkiCard(fullEntry);

        // console.log('checking for ' + JSON.stringify(fullEntry,null,4));
        console.log('card:');
        console.log(card);
        allCards.push(card);
        // process.exit(0);
    });

    await exportAnkiCards(allCards, filename);

}

async function exportAnkiCards(deck, filename){
 
    let fileText = getCSVString(deck);

    return new Promise(resolve=>{
        fs.writeFile(filename,fileText,'utf8', (err) => {  
            // console.log('file wrote');
            if (err) throw err;
            resolve();
        });
    });
}

function getCSVString(deck){
    let fileText = '';
    deck.forEach(card =>{
        fileText += `"${card.front}",,,"${card.back}"\n`;
    });
    return fileText;
}

function createAnkiCard(entry){
    let card = {};
    let front = '<h3>'+entry.word+'</h3>';

    let back = '';

    //for each meaning of the word
    // console.log(JSON.stringify(entry,null,4));

    if(entry.definition.definition!=='unknown'){
        entry.definition.results.forEach((result)=>{
            result.lexicalEntries.forEach((lexicalEntry)=>{
                lexicalEntry.entries.forEach((entry)=>{
                    if(entry.senses){
                        entry.senses.forEach(sense =>{
                            if(sense.definitions){
                                sense.definitions.forEach(definition =>{
                                    back += '<p>'+definition+'</p>\\n';
                                });
                            }else{
                                back += '<p>No Definitions from Oxford Dictionary</p>\\n';
                            }
                            back += '<h4>Examples</h4>\\n';
                            back += '<p>'+result.usage+'</p>';
                            if(sense.examples){
                                sense.examples.forEach(example =>{
                                    back += '<p>'+example.text+'</p>\\n';
                                });
                            }else{
                                back += '<p>No Examples from Oxford Dictionary</p>';
                            }
                        });
                    }
                });
            });
        });
    }else{
        back = '<p>Unknown Definition</p>';
    }
    // console.log('here');
    // console.log('front: ' + front);
    // console.log('back: ' + back);
    card.front = front;
    card.back = back;
    return card;
}


async function getAllDefinitions(words) {
    for(const word of Object.keys(words)){
        let definition =  await lookupDefinition(word);
        // console.log('defintiion for: ' + word);
        
        words[word].definition = definition;

        // console.log(JSON.stringify(words[word],null,4));
        // process.exit(0);
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