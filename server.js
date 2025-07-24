const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Create HTTP server to keep Render service alive
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket Server is running');
});

// Use dynamic port for Render, or fallback to 8080 locally
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ server });

const allPlayers = new Map();
let gamestarted = false;
let gameInterval = null;

function broadcast(message, sender = null) {
  wss.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function activateRandomTile() {
  const randomIndex = Math.floor(Math.random() * 9) + 1;
  const message = JSON.stringify({ type: "activate", index: randomIndex });
  broadcast(message);
}

function leaderboard() {
  const leaderboardData = Array.from(allPlayers.values())
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
  ws.send(JSON.stringify({ type: "your_id", id: ws.id }));

  ws.on('message', function incoming(message) {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (e) {
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
      allPlayers.set(ws, { username: ws.username, score: ws.score });
	  broadcast(`${ws.username} is online `,ws);
	  leaderboard();
      return;
    }

    if (data.type === "host_start") {
      console.log("Host has started the game");
      if (!gamestarted) {
        gamestarted = data.start;
        gameInterval = setInterval(activateRandomTile, 100);
        broadcast(JSON.stringify({ type: "startBtn_clear" }));
		ws.send(JSON.stringify({ type: "resetBtn_display" }));
       
      }
    }

    if (data.type === "click") {
      ws.score += 1;
      data.senderId = ws.id;
      data.score = ws.score;
      console.log(`${ws.username} score: ${ws.score}`);
      ws.send(JSON.stringify({ type: "score", score: ws.score }));
      allPlayers.set(ws, { username: ws.username, score: ws.score });
      leaderboard();
      broadcast(JSON.stringify(data));
    }
	
	if (data.type === "host_reset") {
      console.log("Host has reset the game");
	  if (gamestarted) {
        gamestarted = false;
		
		if (gameInterval !== null) {
		  clearInterval(gameInterval);
		  gameInterval = null;
		}
		
		for (const [playerWS, playerData] of allPlayers.entries()) {
		  playerData.score = 0;
		  playerWS.score = 0;
		  allPlayers.set(playerWS, playerData);
		}
		
		ws.send(JSON.stringify({ type: "startBtn_display" }));
		ws.send(JSON.stringify({ type: "resetBtn_clear" }));
		broadcast(JSON.stringify({ type: "tile_clear" }));
        leaderboard();
      }
    }
	
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${ws.username} (${ws.id})`);
  });
});

// Start the HTTP + WebSocket server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
