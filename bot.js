//Import fetch here somehow
const fetch = require('node-fetch');

//TMI set up for twitch chat connection
const tmi = require('tmi.js');

// Define configuration options
const opts = {
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.OAUTH_TOKEN
  },
  channels: [
    process.env.CHANNEL_NAME, process.env.CHANNEL_NAME2, process.env.CHANNEL_NAME3
  ]
};

// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// ------------------ Globals ------------------
//create dictionary of languages
const lang = {'!jp' : 'ja', 
              '!en' : 'en',
              '!ch' : 'zh',
              '!it' : 'it',
              '!pt' : 'pt',
              '!fr' : 'fr',
              '!ru' : 'ru',
              '!de' : 'de',
              '!es' : 'es'
             };

const ball8 = [ "Yes", "No", "Answer unclear... concentrate and try again", "Breath out the past. Breath in the future",
                "maybe idk lol", "it's a coinflip really...", "yes... maybe no? wait actually yes.. idk", "Probably", "I sure hope not",
                "Probably not", "All signs point to yes", "All signs point to no" ];

var bossfight = {"testChannel":
                   {"Status":"notInProgress", 
                    "Boss":{"Level":0, "Health":0}, 
                    "Users":{}, 
                    "CurrentMove":{}, 
                    "CurrentUser":"None"}
                };

const bossMoves = ["Normal", "AOE"];
const maxUserHealth = 50;
const delay = time => new Promise(res=>setTimeout(res,time));

//------------------ MESSAGE CHECKER ------------------
// Called every time a message comes in
function onMessageHandler (target, context, msg, self) {
  //Ignore bot messages
  if (self) { return; }
  //console output for context
  //console.log(context);
  
  // Remove whitespace from chat message
  const commandName = msg.trim();
  //checks if chatter is staff or broadcaster
  var modCheck = staffCheck(context);
  // Translator function
  if (msg.slice(0, 3) in lang) {
    translate(lang[msg.slice(0, 3)], encodeURIComponent(msg.slice(4)), target, context['display-name']);
    //console.log(`${encodeURIComponent(msg.slice(4))}`);
    console.log(`* Executed ${commandName} command`);
  } 
  // Help function
  else if (commandName === '!help') {
    client.say(target, `!(en, jp, ch, it, pt, fr, ru, de) - translate to target language. `+
              `!bossfight - start a bossfight. !join - to join the bossfight. !8ball - find your fortune! !POG - POG`);
    console.log(`* Executed ${commandName} command`);
  }
  
  // Magic 8-ball
  else if (commandName.slice(0, 6) === '!8ball') {
    var output = ball8[Math.floor(Math.random()*ball8.length)];
    client.say(target, `${output}`);
    console.log(`* Executed ${commandName} command`);
  } 
  
  // Start New Boss Fight
  else if (commandName === '!bossfight')  {
    newFight(target, modCheck, context["room-id"]);
    console.log(`* Executed ${commandName} command`);
  }
  else if (commandName === '!bossfightEnd')  {
    endBattle(target, modCheck, context["room-id"]);
    console.log(`* Executed ${commandName} command`);
  }
  else if (commandName === '!bossfightStart')  {
    startBattle(target, modCheck, context["room-id"]);
    console.log(`* Executed ${commandName} command`);
  }
  // Enter Boss Fight
  else if (commandName === '!join')  {
    joinBattle(target, context['display-name'], context["room-id"]);
  }
  
  // Boss fight moves
  else if (commandName === '!attack')  {
     if (context['display-name'] === bossfight[context["room-id"]]["CurrentUser"]) {
       bossfight[context["room-id"]]["CurrentMove"] = {"Attack":10, "Heal":0, "HealTarget": ""};
     }
  } 
  else if (commandName.slice(0, 5) === '!heal') {
    console.log(commandName);
    console.log(commandName.slice(6));
    if (context['display-name'] === bossfight[context["room-id"]]["CurrentUser"] && (commandName.slice(6) in bossfight[context["room-id"]]["Users"])) {
      bossfight[context["room-id"]]["CurrentMove"] = {"Attack":0, "Heal":10, "HealTarget": commandName.slice(6)};
      bossfight[context["room-id"]]["CurrentMove"]["HealTarget"] = commandName.slice(6);
      console.log(bossfight[context["room-id"]]["CurrentMove"]); 
    }
  }
  
  // POGGERS TESTING
  else if (commandName === '!POG') {
    client.say(target, `POGGERS CHAMPION BOT IS ALIVE`);
    console.log(`* Executed ${commandName} command`);
  } 
  // Unknown command
  else {
    console.log(`* Unknown command ${commandName}`);
  }
}

//------------------ TRANSLATION ------------------
// Function to get DeepL Translation
async function translate (targLang, text, target, userSpeak) {
  const url = `https://api-free.deepl.com/v2/translate?auth_key=${process.env.TL_AUTHKEY}&text=${text}&target_lang=${targLang}`;
  const response = await fetch(url);
  const data = await response.json();
  //console.log(data);
  const output = data["translations"][0]["text"];
  console.log(output);
  client.say(target, `${userSpeak}: ${output}`);
  return null;
}

//------------------ Boss Fight ------------------
// Start new fight
async function newFight (target, modCheck, roomID) {
  if (modCheck === false) {
    client.say(target, `You do not have access to this command!`)
    return null;
  }
  else{
    client.say(target, `Boss Fight starting in 10 seconds! Type (!join) to participate.`)
    bossfight[roomID] = {"Boss":
                           {"Level":0, "Health":0}, 
                         "Users":{}, 
                         "CurrentMove":{}, 
                         "CurrentUser":"None"
                        }
    bossfight[roomID]["Status"] = "waiting";
    setTimeout(startBattle, 10000, target, roomID);
  }
}
// Join Battle
async function joinBattle (target, userSpeak, roomID) {
if (!(roomID in bossfight)) { return null; }
  if (bossfight[roomID]["Status"] === "waiting") {
    bossfight[roomID]["Users"][userSpeak] = maxUserHealth;
    client.say(target,`${userSpeak} has joined the battle. ${JSON.stringify(bossfight[roomID]["Users"])}`);
  } else {
    client.say(target, 'Sorry, you can not join right now.');
  }
}

// Start Battle
async function startBattle (target, roomID) {
  bossfight[roomID]["Boss"]["Health"] = Object.keys(bossfight[roomID]["Users"]).length * 100;
  client.say(target, `Bossfight starting now! Current fighters:${JSON.stringify(bossfight[roomID]["Users"])}.`
                   + `Boss health: ${bossfight[roomID]["Boss"]["Health"]}`);
  bossfight[roomID]["Status"] = "inProgress";
  battling(target, roomID);
  return null;
}

// Next turn 
async function battling (target, roomID) {
  while (bossfight[roomID]["Boss"]["Health"] > 0) {
    for (let user in bossfight[roomID]["Users"]) {
      bossfight[roomID]["CurrentMove"] = {"Attack":10, "Heal":0, "HealTarget": ""};
      bossfight[roomID]["CurrentUser"] = user;
      client.say(target, `${user}, it is your move.`);
      console.log(bossfight[roomID]["Boss"]["Health"]);
      await delay(15000);
      userTurn(target, roomID);
      bossTurn(target, roomID);
      //console.log(user);
      await delay(1000);
    }
  }
  client.say(target, `You win!`);
  bossfight[roomID]["Status"] = "notInProgress";
  return null;
}

// Current User turn
async function userTurn (target, roomID) {
  if (bossfight[roomID]["CurrentMove"]["Heal"] > 0) {//Heal the target
    bossfight[roomID]["Users"][bossfight[roomID]["CurrentMove"]["HealTarget"]] += bossfight[roomID]["CurrentMove"]["Heal"];
    
    // Heal only up to max HP
    if (bossfight[roomID]["Users"][bossfight[roomID]["CurrentMove"]["HealTarget"]] > maxUserHealth) {
      bossfight[roomID]["Users"][bossfight[roomID]["CurrentMove"]["HealTarget"]] = maxUserHealth
    }
    // Text output: Healed target for ~HP. Target now has <in total> HP.
    client.say(target, `Healed ${bossfight[roomID]["CurrentMove"]["HealTarget"]} for `
               +`${bossfight[roomID]["CurrentMove"]["Heal"]}HP! ${bossfight[roomID]["CurrentMove"]["HealTarget"]} `
               +`now has ${bossfight[roomID]["Users"][bossfight[roomID]["CurrentMove"]["HealTarget"]]}HP`);
  }
  
  bossfight[roomID]["Boss"]["Health"] -= bossfight[roomID]["CurrentMove"]["Attack"];
  //Dealt ~damage! Boss currently has <total boss health> Health. 
  client.say(target, `Dealt ${bossfight[roomID]["CurrentMove"]["Attack"]} damage! `
             +`Boss currently has ${bossfight[roomID]["Boss"]["Health"]}HP`);
}

// Boss turn
async function bossTurn (target, roomID) {
  var move = bossMoves[Math.floor(Math.random()*bossMoves.length)];
  console.log(move)
  if (move === "Normal") {
    var keys = Object.keys(bossfight[roomID]["Users"]);
    var targetUser = keys[Math.floor(Math.random() * keys.length)];
    bossfight[roomID]["Users"][targetUser] -= 7;

    client.say(target, `Boss dealt 7 damage! `
               +`${targetUser} currently has ${bossfight[roomID]["Users"][targetUser]}`);
  }
  else if (move === "AOE") {
    for (let user in bossfight[roomID]["Users"]) {
      bossfight[roomID]["Users"][user] -= 2;
      
      client.say(target, `Boss dealt 2 AOE damage! `
               +`${user} currently has ${bossfight[roomID]["Users"][user]}`);
    }
  }
}

// End Battle
async function endBattle (target, modCheck, roomID) {
  if (modCheck === false) {
    client.say(target, `You do not have access to this command!`);
    return null;
  }
  else {
    client.say(target, `Bossfight ending now!`);
    bossfight[roomID]["Status"] = "notInProgress";
  }
}
// Display current users and boss health
// async function healthStatus (target, roomID) {
  
// }

// Move panel

//------------------ MISC FUNCTIONS ------------------
//Checks if Moderator or Broadcaster:
function staffCheck(context) {
  return ((context["mod"] === true) || (context["badges-raw"] === 'broadcaster/1'));
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}
