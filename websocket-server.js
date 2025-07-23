const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const wss = new WebSocket.Server({ port: 8080 });
const allPlayers = new Map();

console.log("WebSocket server running on ws://localhost:8080");

var gamestarted = false;

function broadcast(message, sender = null) {
  wss.clients.forEach(function each(client) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function activateRandomTile() {
  const randomIndex = Math.floor(Math.random() * 9) + 1; // 1 to 9
  const message = JSON.stringify({ type: "activate", index: randomIndex });
  broadcast(message); // Send to all clients
}


function leaderboard() {
  leaderboardData = Array.from(allPlayers.values())
    .map(player => ({ username: player.username, score: player.score }))
    .sort((a, b) => b.score - a.score);

  broadcast(JSON.stringify({ type: "leaderBoard", leaderboard: leaderboardData }));
}

  wss.on('connection', function connection(ws) {
	  ws.id = uuidv4();
	  ws.username = null;
	  ws.score = 0;
	  console.log(`New client connected: ${ws.id}`);
	  ws.send("Welcome! You are connected");
	  
	  ws.send(JSON.stringify({ type: "your_id", id: ws.id })); //send id to client
	  	



  ws.on('message', function incoming(message) {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (e) {
      // It's just a chat message
	  const text = message.toString();
      console.log(`Chat from ${ws.username}:`, text);
	  ws.send(`You: ${text}`);
      broadcast(`${ws.username} : ${text}`, ws);
      return;
    }
	
	if (data.type === "set_username") {
      ws.username = data.username || "Guest";
      console.log(`Client ${ws.id} set username: ${ws.username}`);
	  ws.send(JSON.stringify({ type: "your_username", username: ws.username }));
	  ws.send(JSON.stringify({ type: "start_game", message: "Game started!" }));
	  	
	  ws.score = 0;
	  allPlayers.set(ws, { username: ws.username, score: ws.score });
	 
      return;
    }

	if (data.type === "host_start") {
		console.log("host has start the game")
		if (!gamestarted) {
			gamestarted = data.start;
			setInterval(activateRandomTile,1000);
			broadcast(JSON.stringify({ type: "startBtn_clear" }));	
			
			leaderboard();
		}
    }

    if (data.type === "click") {
		ws.score += 1;
		data.senderId = ws.id;  // attach sender ID
		data.score = ws.score;
		console.log( `${ws.username} score :${ws.score} ` );
		ws.send(JSON.stringify({ type: "score", score: data.score }));
		allPlayers.set(ws, { username: ws.username, score: ws.score });
		
		//Build leaderboard array
		leaderboard();
		broadcast(JSON.stringify(data)); 
		
    }
	
	
  });

  ws.on('close', () => {
    console.log(`Client disconnected : ${ws.username} (${ws.id})`);
   });  
  
});
