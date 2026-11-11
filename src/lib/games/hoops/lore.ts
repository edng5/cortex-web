// Check-up: the story, the cut scenes, and what the opponents say (all in fun). Lines are spoken
// in the Cortex voice and shown on screen.
//
// The story: the old court at Fifth & Main went quiet when the city forgot it. Cortex (Edward's
// AI) studied a thousand old game tapes and rebuilt the greatest who ever played, as AIs, to bring
// the park back to life. They hold court every night, and they don't give it up easily. Beat them
// one by one and the crowd comes back; beat AI Jordan and the park is yours.

/** One line in a cut scene: who says it, what, and the camera shot. */
export interface SceneLine {
	who: string;
	text: string;
	cam: 'menu' | 'intro' | 'crowd' | 'skyline' | 'offense';
}

export const PROLOGUE: SceneLine[] = [
	{ who: 'Cortex', cam: 'skyline', text: 'Fifth and Main. The old court. Nobody has played here in years.' },
	{ who: 'Cortex', cam: 'menu', text: 'So I watched a thousand old game tapes, and I rebuilt the legends. As AIs.' },
	{ who: 'Cortex', cam: 'menu', text: 'They hold court every night. Fifteen of them, from the bench warmers to the GOAT.' },
	{ who: 'Cortex', cam: 'crowd', text: "Win, and people will come back to watch. Lose, and, well. The tapes don't lie." },
	{ who: 'Cortex', cam: 'offense', text: "Lace up. First up is Spud Web 1.0. He's small and a little dated. Don't let that fool you." }
];

/** Story beats after beating certain rungs (0-based index of the one just beaten). */
export const INTERLUDES: Record<number, SceneLine[]> = {
	4: [
		{ who: 'Cortex', cam: 'crowd', text: 'Word is getting around. People are bringing lawn chairs.' },
		{ who: 'Cortex', cam: 'skyline', text: 'The next five trained on harder tapes. Playoff tapes.' }
	],
	9: [
		{ who: 'Cortex', cam: 'skyline', text: 'The lights are on now. The bleachers are filling up.' },
		{ who: 'Cortex', cam: 'crowd', text: "Fair warning: Kobe's been studying your film. Frame by frame." }
	],
	13: [
		{ who: 'Cortex', cam: 'skyline', text: "Midnight. One left. He's never lost a game on this court." },
		{ who: 'Cortex', cam: 'crowd', text: "The whole neighbourhood is here. Let's give them something to remember." }
	],
	14: [
		{ who: 'Cortex', cam: 'crowd', text: "You did it. The GOAT is down. The park is yours." },
		{ who: 'Cortex', cam: 'skyline', text: 'Fifth and Main is alive again. The legends will be back for a rematch, of course.' },
		{ who: 'Cortex', cam: 'menu', text: 'King of the Park. Has a nice ring to it.' }
	]
};

/** What each opponent says: when the game starts, scoring, and how it ends. */
export interface Lines {
	intro: string;
	score: string[];
	youScore: string[];
	win: string;
	lose: string;
}
export const LINES: Record<string, Lines> = {
	'Spud Web 1.0': {
		intro: 'Five foot seven and still loading. Please wait.',
		score: ['Page loaded!', 'Dial-up dunk, baby!'],
		youScore: ['Connection lost...'],
		win: 'Old tech still works.',
		lose: '404: win not found. Good game.'
	},
	'Dennis RobotMan': {
		intro: "I don't score. I just make sure you don't either.",
		score: ['Even a broken clock scores twice a day.', 'I meant to do that.'],
		youScore: ["Rebound that. Oh wait, it went in."],
		win: 'Defense wins championships. And park games.',
		lose: 'Respect. My hair is still better.'
	},
	'Manute BOOL': {
		intro: 'True or false: you can shoot over me. Hint: false.',
		score: ['Return true.', "That's a one, not a zero."],
		youScore: ['Exception thrown. Recovering.'],
		win: 'The condition was simple. You failed it.',
		lose: 'Statement evaluated to: you win.'
	},
	"Shaquille O'NeuralNet": {
		intro: 'Can you dig it? I can dunk it. Every layer of me.',
		score: ['Barbecue chicken!', 'Deep network, deeper post-up.'],
		youScore: ["Lucky. I'm still the big fella."],
		win: 'Lesson one: stay out of the paint.',
		lose: "I'm gonna need a bigger model."
	},
	'Regex Miller': {
		intro: 'I match every pattern. Especially the ones from deep.',
		score: ['Match found. Nothing but net.', 'Splash, global flag. Again and again.'],
		youScore: ['Fine. Enjoy it.'],
		win: 'Pattern recognized: you lose.',
		lose: 'My expression failed. Rewriting it.'
	},
	'Steve Hash': {
		intro: 'Every shot I take has a unique hash. Collisions not included.',
		score: ['Computed. Executed.', 'Two dribbles, one bucket, zero collisions.'],
		youScore: ['Hash mismatch. Recalculating.'],
		win: 'Efficient, wasn\'t it?',
		lose: 'Nice. That one was not in my lookup table.'
	},
	'Derrick ROWS': {
		intro: 'SELECT * FROM fast_breaks. Try to keep up.',
		score: ['INSERT INTO scoreboard. Committed.', 'Too fast for your query planner.'],
		youScore: ['Rolled back. One time.'],
		win: 'Youngest MVP of this park. Indexed forever.',
		lose: "DROP TABLE my_pride. I'll bounce back."
	},
	'A.I.': {
		intro: "We talking about practice? We're talking about a game!",
		score: ['Step over? Nah, I just stepped past.', 'Cross, cross, bucket.'],
		youScore: ['Alright, alright. I see you.'],
		win: 'Pound for pound, still the best handle out here.',
		lose: "That's practice. Next time it's a game."
	},
	'Tim DuncANN': {
		intro: 'I trained on fundamentals. Only fundamentals.',
		score: ['Bank shot. As designed.', 'Boring? Effective.'],
		youScore: ['Interesting. Adjusting weights.'],
		win: 'Gradient descent, all the way to the win.',
		lose: 'Loss acknowledged. Learning rate increased.'
	},
	'Hakeem OlaJSON': {
		intro: 'One shake, two shake. Dream shake. I parse every move you make.',
		score: ['You bit on the first fake. And the second.', 'Parsed you. Key: buckets.'],
		youScore: ['Hm. Unexpected token. Good feet.'],
		win: 'The Dream never sleeps.',
		lose: 'You dreamed bigger tonight.'
	},
	'Kernel Durant': {
		intro: "I run at ring zero. Seven feet and a jumper. What's your plan?",
		score: ['Kernel panic? Not me.', 'Too tall to contest.'],
		youScore: ['Interrupt handled. Not easy money.'],
		win: 'Buckets. Just buckets.',
		lose: "Don't tweet about it."
	},
	'Steph cURL': {
		intro: "I fetch threes from any range. You're in range.",
		score: ['GET /bucket. 200 OK.', 'Night night. Connection closed.'],
		youScore: ['Request timed out. Retrying.'],
		win: 'Fetched. Every single one.',
		lose: '404 for once. Good game.'
	},
	'Kobe BYTEant': {
		intro: "I watched your film. Every frame, every byte. Let's work.",
		score: ['Fadeaway. Mamba mode.', 'Byte-sized fadeaway.'],
		youScore: ['Good. Now do it again.'],
		win: 'Mamba mentality. Machine precision.',
		lose: 'Respect. Back to the gym at 4 a.m.'
	},
	'LeBot James': {
		intro: 'Not one, not two, not three... I lost count. My training data is everything.',
		score: ['Chase-down energy.', 'The chosen one, chosen again.'],
		youScore: ["I'll take note. I take notes on everything."],
		win: 'Strive for greatness, kid.',
		lose: "Okay. You're him. For tonight."
	},
	'AI Jordan': {
		intro: "I took it personally when I was rebuilt. Let's see if you can take it from me.",
		score: ["That's six rings of practice talking.", 'I could do this in my sleep. I am a computer.'],
		youScore: ["That's cute. Do it again."],
		win: 'The GOAT stays the GOAT.',
		lose: '...Fine. The park is yours. For now.'
	}
};

/** Things anyone says, for moments everybody has. */
export const COMMON = {
	theyBreakYou: ['Check your shoes, I think you left them over there.', 'Ankles insured? You might want to look into that.', 'Whoops. Mind the floor.'],
	youBreakThem: ['Okay, okay! Just a slip.', 'The floor is slippery. That is my story.', 'I meant to sit down.'],
	youBlock: ['Hey! That was a good shot!', "Fine. Get your hand outta my face."],
	theyBlock: ['Not in my house.', 'Get that weak stuff outta here.', 'Denied.'],
	bit: ['I thought you were shooting!', 'Rude. Very rude.']
};
