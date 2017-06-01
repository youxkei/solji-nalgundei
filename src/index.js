// @flow
import { Application, Graphics, Sprite, Container, Texture, Point, mesh } from 'pixi.js';

const SCREEN_WIDTH  = 1920;
const SCREEN_HEIGHT = 1080;

type LaserProps = {|
    length: number,
    x: number,
    y: number,
    speed: number,
    speedAccel: number,
    angle: number,
    angleSpeed: number,
    radius: number,
    lineWidth: number,
    backContainer: Container,
    backTexture: Texture,
    frontContainer: Container,
    frontTexture: Texture,
|};

class Laser {
    props: LaserProps;
    frontSprites: Sprite[];
    backSprites: Sprite[];

    constructor(props: LaserProps) {
        if (props.length <= 0) {
            throw "レーザーの長さは1以上である必要がある";
        }

        this.props = props;

        this.frontSprites = [];
        this.backSprites = [];

        for (let i = 0; i < props.length; ++i) {
            const backSprite = new Sprite(props.backTexture);
            backSprite.x = props.x;
            backSprite.y = props.y;
            backSprite.width = backSprite.height = props.radius * 2;
            backSprite.anchor.set(0.5, 0.5);
            props.backContainer.addChild(backSprite);
            this.backSprites.push(backSprite);

            const frontSprite = new Sprite(props.frontTexture);
            frontSprite.x = props.x;
            frontSprite.y = props.y;
            frontSprite.width = frontSprite.height = (props.radius - props.lineWidth) * 2;
            frontSprite.anchor.set(0.5, 0.5);
            props.frontContainer.addChild(frontSprite);
            this.frontSprites.push(frontSprite);
        }
    }

    move() {
        const {
            props: {
                speed,
                speedAccel,
                angle,
                angleSpeed,
                length,
            },
            frontSprites,
            backSprites,
        } = this;

        this.props.x += speed * Math.cos(angle);
        this.props.y += speed * Math.sin(angle);
        this.props.speed += speedAccel;
        this.props.angle += angleSpeed;

        backSprites[0].x = this.props.x;
        backSprites[0].y = this.props.y;

        frontSprites[0].x = this.props.x;
        frontSprites[0].y = this.props.y;

        for (let i = length - 1; 0 < i; --i) {
            backSprites[i].x = backSprites[i - 1].x;
            backSprites[i].y = backSprites[i - 1].y;

            frontSprites[i].x = frontSprites[i - 1].x;
            frontSprites[i].y = frontSprites[i - 1].y;
        }
    }
}

const calcSegmentAngle = (from: {| x: number, y: number |}, to: {| x: number, y: number |}) => {
    return Math.atan2(to.y - from.y, to.x - from.x);
};

type MeshLaserOptions = {|
    numNodes: number,
    x: number,
    y: number,
    speed: number,
    angle: number,
    angleSpeed: number,
    width: number,
    borderWidth: number,
    nodeTexture: {|
        back: Texture,
        front: Texture,
    |},
    edgeTexture: {|
        back: Texture,
        front: Texture,
    |},
    container: {|
        back:  Container,
        front: Container,
    |},
|};

class MeshLaser {
    _options: MeshLaserOptions;
    _nodes: {|
        x: number,
        y: number,
    |}[];
    _vertices: {|
        back: Float32Array,
        front: Float32Array,
    |};
    _uvs: Float32Array;
    _indices: Uint16Array;
    _meshes: {|
        back: mesh.Mesh,
        front: mesh.Mesh,
    |};
    _sprites: {|
        head: {|
            back: Sprite,
            front: Sprite,
        |},
        tail: {|
            back: Sprite,
            front: Sprite,
        |},
    |};

    constructor(options: MeshLaserOptions) {
        const {
            numNodes,
            x,
            y,
            width,
            borderWidth,
            nodeTexture,
            edgeTexture,
            container,
        } = options;

        if (numNodes < 2) {
            throw new Error("レーザーの長さは2以上である必要がある");
        }

        this._options = options;

        this._nodes = new Array(numNodes);
        this._vertices = {
            back: new Float32Array(numNodes * 4),
            front: new Float32Array(numNodes * 4),
        };
        this._uvs = new Float32Array(numNodes * 4);
        this._indices = new Uint16Array(numNodes * 2);

        const segmentLength = 1 / (numNodes - 1);
        for (let i = 0; i < numNodes; ++i) {
            this._nodes[i] = { x, y };

            this._vertices.back[i * 4 + 0] = this._vertices.back[i * 4 + 2] = x;
            this._vertices.back[i * 4 + 1] = this._vertices.back[i * 4 + 3] = y;
            this._vertices.front[i * 4 + 0] = this._vertices.front[i * 4 + 2] = x;
            this._vertices.front[i * 4 + 1] = this._vertices.front[i * 4 + 3] = y;

            this._uvs[i * 4 + 0] = this._uvs[i * 4 + 2] = segmentLength * i;
            this._uvs[i * 4 + 1] = 0;
            this._uvs[i * 4 + 3] = 1;

            this._indices[i * 2 + 0] = i * 2 + 0;
            this._indices[i * 2 + 1] = i * 2 + 1;
        }

        this._meshes = {
            back: new mesh.Mesh(edgeTexture.back, this._vertices.back, this._uvs, this._indices, mesh.Mesh.DRAW_MODES.TRIANGLE_MESH),
            front: new mesh.Mesh(edgeTexture.front, this._vertices.front, this._uvs, this._indices, mesh.Mesh.DRAW_MODES.TRIANGLE_MESH),
        };
        this._sprites = {
            head: {
                back: new Sprite(nodeTexture.back),
                front: new Sprite(nodeTexture.front),
            },
            tail: {
                back: new Sprite(nodeTexture.back),
                front: new Sprite(nodeTexture.front),
            },
        };

        this._sprites.head.back.x = this._sprites.head.front.x = this._sprites.tail.back.x = this._sprites.tail.front.x = x;
        this._sprites.head.back.y = this._sprites.head.front.y = this._sprites.tail.back.y = this._sprites.tail.front.y = y;

        this._sprites.head.back.anchor.set(0.5, 0.5);
        this._sprites.head.front.anchor.set(0.5, 0.5);
        this._sprites.tail.back.anchor.set(0.5, 0.5);
        this._sprites.tail.front.anchor.set(0.5, 0.5);

        this._sprites.head.back.width = this._sprites.head.back.height = this._sprites.tail.back.width = this._sprites.tail.back.height = width;
        this._sprites.head.front.width = this._sprites.head.front.height = this._sprites.tail.front.width = this._sprites.tail.front.height = width - borderWidth * 2;

        container.back.addChild(this._sprites.head.back);
        container.back.addChild(this._sprites.tail.back);
        container.back.addChild(this._meshes.back);
        container.front.addChild(this._sprites.head.front);
        container.front.addChild(this._sprites.tail.front);
        container.front.addChild(this._meshes.front);
    }

    move() {
        const {
            _options: options,
            _nodes: nodes,
            _vertices: vertices,
            _sprites: sprites,
        } = this;

        const {
            numNodes,
            speed,
            angle,
            angleSpeed,
            width,
            borderWidth,
        } = options;

        options.x += speed * Math.cos(angle);
        options.y += speed * Math.sin(angle);
        options.angle += angleSpeed;

        for (let i = numNodes - 1; 0 < i; --i) {
            nodes[i].x = nodes[i - 1].x;
            nodes[i].y = nodes[i - 1].y;
        }

        nodes[0].x = options.x;
        nodes[0].y = options.y;

        sprites.head.back.x = sprites.head.front.x = nodes[0].x;
        sprites.head.back.y = sprites.head.front.y = nodes[0].y;
        sprites.tail.back.x = sprites.tail.front.x = nodes[numNodes - 1].x;
        sprites.tail.back.y = sprites.tail.front.y = nodes[numNodes - 1].y;

        const halfBackWidth = width / 2;
        const halfFrontWidth = (width - borderWidth * 2) / 2;
        const halfPI = Math.PI / 2;

        for (let i = 0; i < numNodes; ++i) {
            const segmentAngle = i === 0 ? calcSegmentAngle(nodes[0], nodes[1]) : calcSegmentAngle(nodes[i - 1], nodes[i]);

            vertices.back[i * 4 + 0] = nodes[i].x + halfBackWidth * Math.cos(segmentAngle - halfPI);
            vertices.back[i * 4 + 1] = nodes[i].y + halfBackWidth * Math.sin(segmentAngle - halfPI);
            vertices.back[i * 4 + 2] = nodes[i].x + halfBackWidth * Math.cos(segmentAngle + halfPI);
            vertices.back[i * 4 + 3] = nodes[i].y + halfBackWidth * Math.sin(segmentAngle + halfPI);

            vertices.front[i * 4 + 0] = nodes[i].x + halfFrontWidth * Math.cos(segmentAngle - halfPI);
            vertices.front[i * 4 + 1] = nodes[i].y + halfFrontWidth * Math.sin(segmentAngle - halfPI);
            vertices.front[i * 4 + 2] = nodes[i].x + halfFrontWidth * Math.cos(segmentAngle + halfPI);
            vertices.front[i * 4 + 3] = nodes[i].y + halfFrontWidth * Math.sin(segmentAngle + halfPI);
        }
    }
}

if (!document.body) throw new Error("invalid body");

const app = new Application(SCREEN_WIDTH, SCREEN_HEIGHT, { antialias: true });

document.body.appendChild(app.view);

const graphics = new Graphics();
graphics.beginFill(0xFF0000, 1);
graphics.drawCircle(0, 0, 64);
graphics.endFill();
const backTexture = graphics.generateCanvasTexture();

graphics.clear();
graphics.beginFill(0x000000, 1);
graphics.drawCircle(0, 0, 64);
graphics.endFill();
const frontTexture = graphics.generateCanvasTexture();

graphics.clear();
graphics.beginFill(0xFF0000, 1);
graphics.drawRect(-64, -64, 64, 64);
graphics.endFill();
const backEdgeTexture = graphics.generateCanvasTexture();

graphics.clear();
graphics.beginFill(0x000000, 1);
graphics.drawRect(-64, -64, 64, 64);
graphics.endFill();
const frontEdgeTexture = graphics.generateCanvasTexture();

const backContainer = new Container();
app.stage.addChild(backContainer);

const frontContainer = new Container();
app.stage.addChild(frontContainer);

let lasers = [];
let lasersNum = 64;
for (let i = 0; i < lasersNum; ++i) {
    lasers.push(new MeshLaser(
        {
            numNodes: 32,
            x: SCREEN_WIDTH / 2,
            y: SCREEN_HEIGHT / 2,
            speed: 6,
            angle: Math.PI * 2 / lasersNum * i,
            angleSpeed: 0.02,
            width: 16,
            borderWidth: 1,
            nodeTexture: {
                back: backTexture,
                front: frontTexture,
            },
            edgeTexture: {
                back: backEdgeTexture,
                front: frontEdgeTexture,
            },
            container: {
                back: backContainer,
                front: frontContainer,
            },
        },
    ));

    lasers.push(new MeshLaser(
        {
            numNodes: 32,
            x: SCREEN_WIDTH / 2,
            y: SCREEN_HEIGHT / 2,
            speed: 6,
            angle: Math.PI * 2 / lasersNum * i,
            angleSpeed: -0.02,
            width: 16,
            borderWidth: 1,
            nodeTexture: {
                back: backTexture,
                front: frontTexture,
            },
            edgeTexture: {
                back: backEdgeTexture,
                front: frontEdgeTexture,
            },
            container: {
                back: backContainer,
                front: frontContainer,
            },
        },
    ));
}

/*
const m = new mesh.Mesh(
    backEdgeTexture,
    new Float32Array([
        10 * 5, 10 * 5,
        10 * 5, 20 * 5,
        10 * 5, 10 * 5,
        10 * 5, 20 * 5,
        30 * 5, 10 * 5,
        30 * 5, 20 * 5,
    ]),
    new Float32Array([
        0, 0,
        0, 1,
        0, 0,
        0, 1,
        1, 0,
        1, 1,
    ]),
    new Uint16Array([0, 1, 2, 3, 4, 5]),
);

app.stage.addChild(m);
*/

let count = 0;
let previousCount = 0;
let previousTime = performance.now();
app.ticker.add(function() {
    for (const laser of lasers) {
        laser.move();
    }

    ++count;

    const nowTime = performance.now();
    if (count % 60 === 0) {
        console.log(Math.floor(60 / (nowTime - previousTime) * 100000) / 100);
        previousTime = nowTime;
    }
});
