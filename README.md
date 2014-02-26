# Ukkio SDK

SDK to connect your game to Ukkio (http://developer.ukk.io).

## Getting started

- Install [ukkio-cli](https://github.com/ukkio/ukkio-cli) tool.

	```
	$ npm install ukkio-cli -g
	```

- Install SDK as you prefer:

	```js
	bower install ukkio-sdk
	```

	or clone the git repository


- Include SDK in your HTML

	```html
	<script src="ukkiosdk.js"></script>
	```

- Start sandbox 

	```
	$ cd your/game/folder
	$ ukkio sandbox
	$ Sandbox started: point your browser at http://localhost:5005/
	```

- Start programming!

## Understanding the game life cycle

In Ukkio the games must be designed to work with coin, in other words you earn money every time a player insert a coin. This is by design.
The main target of SDK is to give you a simple way to consume the coins plus some basic feautures that could be ignored depending on the type of game you are building. 

SDK are based on events. There are several types of events that comes from Ukkio (`newGame`, `pause`, `unpause`, `changeViewport`) and 
a few methods (`ready`, `insertCoin`, `gameOver`, `exit`) that let you send and retrive data (`saveSession`, `loadSession`, `saveStorage`, `loadStorage`).

When a player start your game, Ukkio creates an iframe on the page, that cover any UI element on the window, and executes your script.
After all your stuff are loaded, you have to say to Ukkio - Hey, I'm `ready`! - using the `ready()` function. Ukkio responds with the `newGame` events. From now on you are ready to ask the player to insert coin using `insertCoin()`, many kind of things could happen after this call: 

1. The user accepts (`success`)
2. The user rejects (`cancel`)
3. The user has no coins (`failure`)

You have to manage all of them. 

For simplicity we go for the first case. The game started and after some levels he losts, now you have to tell Ukkio that the coin is burned using `gameOver()`. Now you can request a new coin to the player, but if he wants to go back on the games list (remember?) there is no UI on the screen to do so. 
Here is where you come in for help drawing a (what you want) button that calls `exit()`.

That would be enough for a certain types of games, but if you want to let the player to continue from a certain point, you need a way to save data. 
HTML5 has localStorage but it lives only on the device in use. Not enough for a cool HTML5 game. 
Ukkio provides two methods: `saveStorage` and `loadStorage`. With them you can save and retrive an object from any device. 
Storage is unique for the couple: player, game. Oh..they work off-line too, look bottom for more informations.

Ukkio has another couple of things to deliver a great user experience: `pause` and `unpause`. Imagine the case when you are playing the latest browser's game (Galaga) at the office (Helicarrier) and your boss (Tony Stark) knocks on the door and you quickly press CMD+TAB (ALT+TAB for others). What happend to your game (Game over!)? 
To avoid this catastrophic scenario Ukkio sends a `pause` event when window lost the focus. Pause has a callback that accept a data object that is stored first on the localStorage and then on the server. So you can close browser and continue the game more late (when Tony is gone away).
`unpause`, instead, is triggered when window gets the focus. All previously stored data are passed as parameter. If you want to read or write
pause and unpause data at anytime you can use `saveSession()` and `loadSession()` but be careful, that data lives like a coin. 
When you call `gameOver()` session is deleted immediatly.


## Events

### newGame(data)

Invoked after a `ready` call. The game is ready to start. Data passed from Ukkio contains the game mode (`new`, `resume`) and the player's data.

```js
var ukkio = new UkkioSDK({
	apiKey: 'myAPIKey'
});

ukkio.on('newGame', function (gameData) {
	// Game is ready to start
	main();
});

// Tells to Ukkio the game is ready. 
// Options works only in the sandbox, in the production they are ignored.
ukkio.ready({
	verbose: true,
	user: { coins: 10 }
});
```

Data contains:

- `mode`: can be `new` or `resume`. If `new`, this is a new game and it require an `insertCoin()` to start. If `resume`, the game was paused so no
  game over occurred. In this case you have to restore session data and start the game from the saved point. Use `session` key for this. 
  Call `insertCoin()` in this case will throw an error.
- `user`: contains player's data.

	```js
	user: {
		"username": "gamedeveloper",
		"coins": 100,
		"locale": "en",
		"timezone": '2'
	}
	```

- `session`: null if `mode` is equal to `new`. It contains data stored on `pause` events or using `saveSession()`.
- `storage`: it contains persistent data stored using `saveStorage()`.


### pause(callback)

Invoked after the game container lost the focus. Callback(gameData) accepts an object with the necessary data to resume the game in a second time.

```js
ukkio.on('pause', function (callback) {
	// On pause saves score and birdie's position to be 
	// restored in another device (mobile phone?).
	callback({
		score: score,
		birdie: {
			x: birdie.x,
			y: birdie.y,
			angle: birdie.angle
		}
	});
});
```

### unpause(gameData)

Invoked after the game container gets the focus. `gameData` contains exactly the object you stored on `pause`.

```js
ukkio.on('unpause', function (data) {
	// On unpause restores data of the last game like score
	// and birdie position. 
	// Important! This code has no effects, take it as a pure example.
	score = data.score;
	birdie.x = data.birdie.x;
	birdie.y = data.birdie.y;
	birdie.angle = data.birdie.angle;
});
```

### changeViewport(viewport)

Invoked when the window is resized or smartphone change orientation. Created because some framework has problems to detect
resize or orientation changes when inside an iframe.

```js
ukkio.on('changeViewport', function (viewport) {
	stage.width = viewport.width;
	stage.height = viewport.height;
});
```



## Methods

### ready(options)

Call this method when you are ready to recive player's informations. That method start the Ukkio life cycle. 
The parameter `options` works only in the sandbox and is useful to test session, storage, not enough coins, etc...

```js
ukkio.ready({
	verbose: true,
	user: { coins: 0 },
	session: { foo: 'bar' },
	storage: { persistenFoo: 'persistentBar' }
});
```

Options:

- `user`: you overwrite user's profile with custom data.

	```js
	user: {
		"username": "gamedeveloper",
		"coins": 100,
		"locale": "en",
		"timezone": '2'
	}
	```

- `session`: custom data for the session. If session is not null `newGame` events receives a `mode: 'resume'`
- `storage`: custom data for the storage.
- `verbose`: true or false. If true any interaction with the SDK will be shown in the console.

### insertCoin(callback)

Asks to the player to insert a coin. In the sandbox a coin is consumed immediatly without user's interactions. 
On Ukkio a "fullscreen" dialog asks to insert a coin. Player has the capability to accept or reject.
Callback(result) passes a parameter with the result string of transaction.

```js
ukkio.insertCoin(function (result) {
	if (result == 'success') {
		start();
	}
	else {
		mainMenu();
	}
});
```

Result can be:

- `success`: transaction is completed. You earned money!!
- `failure`: not enough coins.
- `cancel`: player has rejected.

### gameOver(callback)

Call it when player ended his game section. Remember, only after game over you can ask for a new coin.
Callback() has no parameters.

```js
ukkio.gameOver(function () {
	gameOver = true;
	...
	ukkio.saveStorage({ hiscore: hiscore }, function() {
		...
		mainMenu();
	}

```

### exit()

Calls it when a user want to go back to the game list. To let you use all pixels on the screen we don't inserts a toolbar, a banner 
or something else. For this we ask to you to handle the exit button. The only action to do is to call ukkio.exit() and the iframe
in which the game is loaded will be deleted from the page. Remember to save all before exit. 

If game is over consider this:

```js
ukkio.saveStorage({ some: 'data' }, function () {
	ukkio.exit();
});
```

If game still running:

```js
ukkio.saveSession({ some: 'data' }, function () {
	ukkio.exit();
});
```

or the player will lose the game's status.

### saveStorage(data, callback)

Saves `data` to the persistent storage. Ukkio saves `data` in the localStorage and then pushes it to the server. 
Persistent storage is unique for the player. Any call of `saveStorage()` will overwrite old data. 
`Callback` has no parameters.

```js
function onGameOver() {
	ukkio.loadStorage(function (data) {
		var hiscore = score > data.hiscore ? score : data.hiscore;
		ukkio.saveStorage({ hiscore: hiscore }, function() {
			mainMenu();
		});
	});
}
```

### loadStorage(callback)

Loads data from the persistent storage. `callback(data)` first parameter contains stored data.

```js
ukkio.loadStorage(function (data) {
	highscoreText.text = data.hiscore;
});
```
### saveSession(data, callback)

Saves `data` to the session. Session is where Ukkio saves data that lives one game life cycle 
(for more informations refer the "Understand the game life cycle").

```js
ukkio.saveSession(function (data) {
	highscoreText.text = data.hiscore;
});
```

### loadSession(data)

Loads data from the session. `callback(data)` first parameter contains stored data.

```js
ukkio.loadSession(function (data) {
	hero.x = data.hero.x;
	hero.y = data.hero.y;
	hero.z = data.hero.z;
	hero.angle = data.hero.angle;
	inventory = data.inventory;
});
```

## References

Visit developer site for more informations on Ukkio: [http://developer.ukk.io](http://developer.ukk.io)


## License

```
The MIT License (MIT)

Copyright (c) 2014 Ukkio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
