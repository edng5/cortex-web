// The game's small classes (Bullets, Clouds, EnemiesJ, EnemiesR, Missiles, Ships, aBase),
// ported line for line from the original Java.
import { Rect, Shape, rnd } from './geometry';

export class Bullets {
	size = 0; y_speed = 0; x_speed = 0; x = 0; y = 0; delay = 0; alive = 1; shot = 0; reset = 0;
	changesize = 0; timer = 0; launch = 0;
	boundary = new Rect(0, 0, 0, 0);

	create() {
		this.size = 15;
		this.y_speed = 0;
		this.x_speed = 0;
		this.changesize = 0;
		this.boundary = new Rect(this.x, this.y, this.size, this.size);
	}

	move() {
		this.x += this.x_speed;
		this.y += this.y_speed;
		this.delay++;
		if (this.delay == 3) {
			this.size += this.changesize;
			this.delay = 0;
		}
		this.boundary = new Rect(this.x, this.y, this.size, this.size);
	}

	checkBoundary() {
		if (this.y < 170) {
			this.x_speed = 0;
			this.y_speed = 0;
			this.y = 300;
			this.reset = 1;
			this.changesize = 0;
			this.size = 15;
		}
	}
}

export class Clouds {
	size = 0; y_speed = 0; x_speed = 0; x = 0; y = 0; delay = 0; reset = 0; changesize = 0;
	boundary = new Rect(0, 0, 0, 0);

	create() {
		this.size = 1;
		this.x = 300;
		this.y = 100;
		this.changesize = 2;
		this.boundary = new Rect(this.x, this.y, this.size, this.size);
	}

	move() {
		this.x += this.x_speed;
		this.y += this.y_speed;
		this.delay++;
		if (this.delay == 2) {
			this.size += this.changesize;
			this.delay = 0;
		}
		this.boundary = new Rect(this.x, this.y, this.size, this.size);
	}

	checkBoundary() {
		if (this.y > 600 || this.y < -60) {
			this.y = rnd(400);
			this.x = rnd(500);
			this.size = 1;
		}
	}
}

export class EnemiesJ {
	sizeW = 0; sizeH = 0; y_speed = 0; x_speed = 0; x = 0; y = 0; delay = 0; delay2 = 0; reset = 0;
	changesizeW = 0; changesizeH = 0; stop = 0; go = 0; leave = 0; trigger = 0; deathTimer = 0;
	range1 = 300; range2 = 100;
	boundary = Shape.rect(0, 0, 0, 0);

	create() {
		this.sizeH = 1;
		this.sizeW = 3;
		this.x = 300;
		this.y = 100;
		this.changesizeW = 2;
		this.changesizeH = 1;
		this.boundary = Shape.rect(this.x, this.y, this.sizeW, this.sizeH);
	}

	move() {
		if (this.stop == 0) {
			this.x += this.x_speed;
			this.y += this.y_speed;
			this.delay++;
			if (this.delay == 2) {
				this.sizeW += this.changesizeW;
				this.sizeH += this.changesizeH;
				this.delay = 0;
			}
		}
		this.boundary = Shape.rect(this.x, this.y, this.sizeW, this.sizeH);
	}

	checkBoundary() {
		if (this.y > 400 || this.y < -100 || this.x > 600 || this.x < -100) {
			this.y = rnd(this.range1) + this.range2;
			this.x = rnd(400) + 50;
			this.sizeW = 3;
			this.sizeH = 1;
			this.stop = 0;
			this.trigger = 0;
			this.leave = 0;
			this.go = 0;
		} else if (this.sizeW > 25 && this.go < 80 && this.leave == 0) {
			if (this.y < 200 && this.y > 50) {
				this.stop = 1;
				this.x_speed = 0;
				this.y_speed = 0;
			}
		}
	}
}

/** Enemy dots on the radar. */
export class EnemiesR {
	sizeW = 0; sizeH = 0; y_speed = 0; x_speed = 0; x = 0; y = 0; delay = 0; alive = 1; shot = 0;

	create() {
		this.sizeW = 10;
		this.sizeH = 10;
		this.y_speed = 3;
		this.x_speed = 0;
		this.x = 280;
		this.y = 350;
	}

	move() {
		this.delay++;
		if (this.delay == 10) {
			this.y += this.y_speed;
			this.delay = 0;
		}
	}
}

export class Missiles {
	size = 0; y_speed = 0; x_speed = 0; x = 0; y = 0; delay = 0; changesize = 0; reset = 0; shot = 0; fired = 0;
	boundary = Shape.rect(0, 0, 0, 0);

	create() {
		this.size = 30;
		this.y_speed = 0;
		this.x_speed = 0;
		this.x = 280;
		this.y = 320;
		this.changesize = 0;
		this.boundary = Shape.rect(this.x, this.y, this.size, this.size);
	}

	move() {
		this.x += this.x_speed;
		this.y += this.y_speed;
		this.delay++;
		if (this.delay == 3) {
			this.size += this.changesize;
			this.delay = 0;
		}
		this.boundary = Shape.rect(this.x, this.y, this.size, this.size);
	}

	returnMissile() {
		this.x_speed = 0;
		this.y_speed = 0;
		this.y = 320;
		this.reset = 1;
		this.changesize = 0;
		this.size = 30;
		this.shot = 0;
		this.fired = 0;
	}
}

export class Ships {
	sizeW = 0; sizeH = 0; y_speed = 0; x_speed = 1; x = 0; y = 0; delay = 0; alive = 1; shot = 0; health = 5;
	trigger = 0; deathTimer = 0;
	boundary = Shape.rect(0, 0, 0, 0);

	create() {
		this.sizeW = 30;
		this.sizeH = 15;
		this.x_speed = 2;
		this.boundary = Shape.rect(this.x, this.y, this.sizeW, this.sizeH);
	}

	move() {
		this.delay++;
		if (this.delay == 2) {
			this.x += this.x_speed;
			this.delay = 0;
		}
		this.boundary = Shape.rect(this.x, this.y, this.sizeW, this.sizeH);
	}

	dead() {
		if (this.health <= 0) {
			this.x = rnd(20) - 100;
			this.health = 5;
			this.trigger = 0;
		}
	}

	checkBoundary() {
		if (this.x > 600) {
			this.x = rnd(60) - 100;
			this.health = 5;
		}
	}
}

/** The army base (mission 3). */
export class ABase {
	sizeW = 0; sizeH = 0; y_speed = 0; x_speed = 0; x = 0; y = 0; delay = 0; delay2 = 0; reset = 0;
	changesizeW = 0; changesizeH = 0; stop = 0; go = 0; leave = 0; trigger = 0; deathTimer = 0;
	range1 = 300; range2 = 100; initial = -1; check = 0; health = 100;
	boundary = Shape.rect(0, 0, 0, 0);

	create() {
		this.sizeH = 4;
		this.sizeW = 10;
		this.x = 150;
		this.y = 900;
		this.y_speed = -1;
		this.x_speed = -3;
		this.changesizeW = 3;
		this.changesizeH = 1;
		this.boundary = Shape.rect(this.x, this.y, this.sizeW, this.sizeH);
	}

	appear() {
		this.delay++;
		this.delay2++;
		if (this.delay == 5) {
			this.sizeW += this.changesizeW;
			this.sizeH += this.changesizeH;
			this.delay = 0;
		}
		if (this.delay2 == 10) {
			this.y += this.y_speed;
			this.x += this.x_speed;
			this.delay2 = 0;
		}
		this.boundary = Shape.rect(this.x, this.y, this.sizeW, this.sizeH);
	}
}
