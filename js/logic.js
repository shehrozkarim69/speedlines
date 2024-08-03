// Utility functions
const randomFactor = () => 0.5 + Math.random() * 0.5;
const radToDeg = (rad) => (rad * 180) / Math.PI;
const degToRad = (deg) => (deg * Math.PI) / 180;

class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    static fromAngle(angle, length = 1) {
        return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }

    div(n) {
        this.x /= n;
        this.y /= n;
        return this;
    }

    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
        const m = this.mag();
        if (m !== 0) this.div(m);
        return this;
    }

    setMag(len) {
        return this.normalize().mult(len);
    }

    copy() {
        return new Vector2(this.x, this.y);
    }
}

class Line {
    constructor(canvas, settings, isInitial = false) {
        this.canvas = canvas;
        this.settings = settings;
        this.pos = new Vector2();
        this.vel = new Vector2();
        this.initialize(isInitial);
    }

    initialize(isInitial = false) {
        const { type, angle, emitterRadius, emitterX, emitterY, speed, length } = this.settings;
        const emitterPos = new Vector2(this.canvas.width * (emitterX / 100), this.canvas.height * (emitterY / 100));
        
        this.randomizedEmitterRadius = emitterRadius * randomFactor();
        this.speed = speed * randomFactor();
        this.length = length * randomFactor();
        
        const angleRad = type === 'radial' ? Math.random() * Math.PI * 2 : degToRad(angle);
        
        if (type === 'radial') {
            const maxDistance = Math.max(this.canvas.width, this.canvas.height);
            const initialDistance = isInitial ? Math.random() : (this.speed >= 0 ? 0 : 1);
            const r = this.randomizedEmitterRadius + initialDistance * maxDistance;
            this.pos = Vector2.fromAngle(angleRad, r).add(emitterPos);
            this.vel = Vector2.fromAngle(angleRad, Math.abs(this.speed));
        } else {
            this.pos = new Vector2(Math.random() * this.canvas.width, Math.random() * this.canvas.height);
            this.vel = Vector2.fromAngle(angleRad, this.speed);
        }

        this.sizes = ['initialSize', 'middleSize', 'endSize'].map(size => this.settings[size] * randomFactor());
    }

    update() {
        const { type, emitterX, emitterY } = this.settings;
        const emitterPos = new Vector2(this.canvas.width * (emitterX / 100), this.canvas.height * (emitterY / 100));
        
        if (type === 'linear') {
            this.pos.add(this.vel);
            this.wrapPosition();
        } else {
            const toEmitter = emitterPos.copy().sub(this.pos);
            const distance = toEmitter.mag();
            
            if (this.speed >= 0) {
                this.pos.add(this.vel);
                if (distance > Math.max(this.canvas.width, this.canvas.height) / 2) {
                    this.initialize();
                }
            } else {
                this.pos.sub(this.vel);
                if (distance <= this.randomizedEmitterRadius) {
                    this.initialize();
                }
            }
        }
    }

    wrapPosition() {
        if (this.pos.x < 0) this.pos.x = this.canvas.width;
        if (this.pos.x > this.canvas.width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = this.canvas.height;
        if (this.pos.y > this.canvas.height) this.pos.y = 0;
    }

    draw(ctx) {
        const { type, emitterX, emitterY, color } = this.settings;
        const emitterPos = new Vector2(this.canvas.width * (emitterX / 100), this.canvas.height * (emitterY / 100));
        
        const endPos = type === 'radial'
            ? this.pos.copy().add(this.pos.copy().sub(emitterPos).setMag(this.length))
            : this.pos.copy().sub(this.vel.copy().setMag(this.length));

        const midPos = this.pos.copy().add(endPos).div(2);
        const perpAngle = Math.atan2(endPos.y - this.pos.y, endPos.x - this.pos.x) + Math.PI / 2;
        const perpVector = Vector2.fromAngle(perpAngle);

        ctx.fillStyle = color;

        // Draw positive half
        ctx.beginPath();
        this.drawHalfLine(ctx, this.pos, midPos, endPos, perpVector, 1);
        ctx.fill();

        // Draw negative half
        ctx.beginPath();
        this.drawHalfLine(ctx, this.pos, midPos, endPos, perpVector, -1);
        ctx.fill();
    }

    drawHalfLine(ctx, startPos, midPos, endPos, perpVector, sign) {
        const shift = 0.5; // Adjust this value to control the overlap
        const shiftVector = perpVector.copy().mult(shift * sign);

        ctx.moveTo(
            startPos.x + perpVector.x * this.sizes[0] * sign / 2 - shiftVector.x,
            startPos.y + perpVector.y * this.sizes[0] * sign / 2 - shiftVector.y
        );
        ctx.lineTo(
            midPos.x + perpVector.x * this.sizes[1] * sign / 2 - shiftVector.x,
            midPos.y + perpVector.y * this.sizes[1] * sign / 2 - shiftVector.y
        );
        ctx.lineTo(
            endPos.x + perpVector.x * this.sizes[2] * sign / 2 - shiftVector.x,
            endPos.y + perpVector.y * this.sizes[2] * sign / 2 - shiftVector.y
        );
        ctx.lineTo(
            endPos.x - shiftVector.x,
            endPos.y - shiftVector.y
        );
        ctx.lineTo(
            startPos.x - shiftVector.x,
            startPos.y - shiftVector.y
        );
    }

}

class AnimeSpeedlines {
    constructor(canvas, settings) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.settings = settings;
        this.lines = [];
        this.createLines();
        this.boundAnimate = this.animate.bind(this);
        this.animationId = null;
    }

    createLines() {
        this.lines = Array.from({ length: this.settings.count }, () => new Line(this.canvas, this.settings, true));
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.lines.forEach(line => {
            line.update();
            line.draw(this.ctx);
        });
        this.animationId = requestAnimationFrame(this.boundAnimate);
    }

    updateSettings(newSettings) {
        const oldSettings = { ...this.settings };
        Object.assign(this.settings, newSettings);
        
        const relevantSettings = ['type', 'angle', 'emitterRadius', 'emitterX', 'emitterY', 'speed', 'length', 'color', 'initialSize', 'middleSize', 'endSize'];
        const hasRelevantChanges = relevantSettings.some(setting => oldSettings[setting] !== this.settings[setting]);
        
        if (hasRelevantChanges) {
            this.lines.forEach(line => {
                line.settings = this.settings;
                line.initialize();
            });
        }

        if (oldSettings.count !== this.settings.count) {
            this.createLines();
        }
    }

    start() {
        if (!this.animationId) {
            this.animate();
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.createLines();
    }
}

// Setup and event handling
function initializeSpeedlines() {
    const canvas = document.getElementById('speedlineCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const initialSettings = {
        type: "linear",
        count: 30,
        speed: -20,
        length: 1000,
        color: "#ffffff",
        initialSize: 1,
        middleSize: 10,
        endSize: 1,
        emitterRadius: 250,
        angle: 45,
        emitterX: 50,
        emitterY: 50
    };

    const speedlines = new AnimeSpeedlines(canvas, initialSettings);
    speedlines.start();

    return { speedlines, initialSettings };
}

function setupEventListeners(speedlines, initialSettings) {
    const updateSettings = () => {
        const newSettings = Object.fromEntries(
            ['type', 'count', 'speed', 'length', 'color', 'initialSize', 'middleSize', 'endSize', 'emitterRadius', 'angle', 'emitterX', 'emitterY']
            .map(id => [id, document.getElementById(id).value])
        );
        speedlines.updateSettings(newSettings);
        document.getElementById('currentSettings').textContent = JSON.stringify(newSettings, null, 2);
    };

    const updateForms = (settings) => {
        Object.entries(settings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) element.value = value;
        });
    };

    document.querySelectorAll('#controls input, #controls select').forEach(control => 
        control.addEventListener('input', updateSettings)
    );

    window.addEventListener('resize', () => speedlines.resize(window.innerWidth, window.innerHeight));

    updateForms(initialSettings);
    updateSettings();
}

document.addEventListener('DOMContentLoaded', () => {
    const { speedlines, initialSettings } = initializeSpeedlines();
    setupEventListeners(speedlines, initialSettings);
});