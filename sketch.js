// =========================
// FULL UPDATED sketch.js
// =========================

const INFO_TOTAL_DURATION = 18000;
const SENTENCE_DURATION = 5500;
const ANIMAL_OUTSIDE_DURATION = 15000;
const RESET_TIME = 60000;

let video;
let bodySegmentation;
let segmentation;

let bodyPose;
let poses = [];

let prettyBg;
let constructionBg;
let prettyScaled;

let tempBuffer;
let bgBuffer;

let ghostImg;

let spirits = [];
const GHOST_COUNT = 30;

let speciesData = [];
let activeInfo = null;

let startTime;

function preload() {
  ghostImg = loadImage("assets/animals/ghost.png");
  prettyBg = loadImage("assets/grass.jpg");
  constructionBg = loadImage("assets/construction.png");

  let northAtlanticRightWhaleImg = loadImage("assets/animals/northAtlanticRightWhale.png");
  let gopherTortoiseImg = loadImage("assets/animals/gopherTortoise.png");
  let redCockadedWoodpeckerImg = loadImage("assets/animals/redCockadedWoodpecker.png");
  let westIndianManateeImg = loadImage("assets/animals/westIndianManatee.png");
  let loggerHeadSeaTurtleImg = loadImage("assets/animals/loggerHeadSeaTurtle.png");
  let woodStorkImg = loadImage("assets/animals/woodStork.png");
  let etowahDarterImg = loadImage("assets/animals/etowahDarter.png");

  speciesData = [
    {
      img: northAtlanticRightWhaleImg,
      bubbleColor: [70, 110, 190],
      info: [
        "Hi! I'm the North Atlantic Right Whale.",
        "I live in the coastal waters of Georgia during the winter to have my calves.",
        "I'm endangered because of vessel strikes and entanglement in fishing gear.",
        "Only about 380 of me are left in the entire world."
      ]
    },
    {
      img: gopherTortoiseImg,
      bubbleColor: [181, 126, 62],
      info: [
        "Hi! I'm the Gopher Tortoise.",
        "I live in the sandy pine forests of Southern Georgia.",
        "I'm endangered because of habitat loss due to development and lack of prescribed fires.",
        "About 65 viable populations are now permanently protected in Georgia."
      ]
    },
    {
      img: redCockadedWoodpeckerImg,
      bubbleColor: [176, 63, 63],
      info: [
        "Hi! I'm the Red-cockaded Woodpecker.",
        "I live in old-growth pine forests in Middle and South Georgia.",
        "I'm endangered because I can only nest in living pine trees, which are being cut down.",
        "About 800 to 1,000 clusters are left in Georgia."
      ]
    },
    {
      img: westIndianManateeImg,
      bubbleColor: [74, 145, 134],
      info: [
        "Hi! I'm the West Indian Manatee.",
        "I live in coastal rivers and estuaries during the warm summer months.",
        "I'm endangered because of collisions with watercraft.",
        "Several hundred of us visit Georgia's waters each year."
      ]
    },
    {
      img: loggerHeadSeaTurtleImg,
      bubbleColor: [88, 140, 86],
      info: [
        "Hi! I'm the Loggerhead Sea Turtle.",
        "I live on Georgia's barrier island beaches to lay my eggs.",
        "I'm endangered because of beachfront lighting and accidental capture in nets.",
        "We had over 3,000 nests recorded in Georgia recently."
      ]
    },
    {
      img: woodStorkImg,
      bubbleColor: [120, 120, 120],
      info: [
        "Hi! I'm the Wood Stork.",
        "I live in the swamps and marshes of South Georgia.",
        "I'm endangered because of the destruction of wetlands.",
        "About 2,500 to 3,000 nesting pairs are left in Georgia."
      ]
    },
    {
      img: etowahDarterImg,
      bubbleColor: [140, 88, 170],
      info: [
        "Hi! I'm the Etowah Darter.",
        "I live exclusively in the Etowah River Basin in North Georgia.",
        "I'm endangered because of water pollution and urban runoff.",
        "I am found in only a few small creek sections."
      ]
    }
  ];

  bodySegmentation = ml5.bodySegmentation("SelfieSegmentation", {
    maskType: "background"
  });
}

function setup() {
  createCanvas(3072, 1280);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  tempBuffer = createGraphics(width, height);
  bgBuffer = createGraphics(width, height);

  prettyScaled = createGraphics(width, height);
  prettyScaled.image(prettyBg, 0, 0, width, height);

  bodySegmentation.detectStart(video, (res) => segmentation = res);

  bodyPose = ml5.bodyPose("MoveNet", {
    modelType: "MULTIPOSE_LIGHTNING"
  });
  bodyPose.detectStart(video, (res) => poses = res);

  for (let i = 0; i < GHOST_COUNT; i++) {
    let s = new Spirit(ghostImg, random(speciesData));
    s.x = random(width - 100);
    s.y = random(height - 100);
    spirits.push(s);
  }

  startTime = millis();
  textFont("Courier New");
}

function draw() {
  if (millis() - startTime > RESET_TIME) resetAll();

  background(0);

  drawCameraBW();
  drawSilhouette();
  drawDigitalSkeletons();

  let people = getPeople();

  for (let s of spirits) {
    s.update();

    if (s.state === "ghost") {
      if (!activeInfo && checkCollision(s)) {
        let p = getClosestPerson(s, people);
        if (p) startInteraction(s, p);
      }
    }

    if (s.state === "attached") moveAttached(s);
    if (s.state === "released") moveReleased(s);

    s.display();
  }

  updateInfo();
  drawBubble();

  drawPeopleCounter(people.length);
  drawCountdownTimer();
  drawCropMarks();
}

function drawCameraBW() {
  if (!video.loadedmetadata) return;

  bgBuffer.clear();
  bgBuffer.push();
  bgBuffer.translate(width, 0);
  bgBuffer.scale(-1, 1);
  bgBuffer.image(video, 0, 0, width, height);
  bgBuffer.pop();
  bgBuffer.filter(GRAY);
  image(bgBuffer, 0, 0);
}

function drawSilhouette() {
  if (!segmentation || !segmentation.maskImageData) return;

  let maskImg = createImage(video.width, video.height);
  maskImg.loadPixels();

  let data = segmentation.maskImageData.data;
  for (let i = 0; i < data.length; i += 4) {
    maskImg.pixels[i] = 255;
    maskImg.pixels[i + 1] = 255;
    maskImg.pixels[i + 2] = 255;
    maskImg.pixels[i + 3] = data[i + 3];
  }
  maskImg.updatePixels();

  tempBuffer.clear();
  tempBuffer.push();
  tempBuffer.translate(width, 0);
  tempBuffer.scale(-1, 1);
  tempBuffer.image(maskImg, 0, 0, width, height);
  tempBuffer.pop();

  let sil = prettyScaled.get();
  sil.mask(tempBuffer);
  image(sil, 0, 0);
}

function drawDigitalSkeletons() {
  if (!poses || poses.length === 0) return;

  for (let pose of poses) {
    let keypoints = pose.keypoints || [];
    if (!keypoints.length) continue;

    drawPoseLine(keypoints, "left_shoulder", "right_shoulder", [255, 0, 0]);
    drawPoseLine(keypoints, "left_shoulder", "left_elbow", [0, 100, 255]);
    drawPoseLine(keypoints, "left_elbow", "left_wrist", [0, 255, 255]);
    drawPoseLine(keypoints, "right_shoulder", "right_elbow", [255, 255, 0]);
    drawPoseLine(keypoints, "right_elbow", "right_wrist", [180, 255, 0]);
    drawPoseLine(keypoints, "left_shoulder", "left_hip", [0, 255, 0]);
    drawPoseLine(keypoints, "right_shoulder", "right_hip", [0, 255, 255]);
    drawPoseLine(keypoints, "left_hip", "right_hip", [255, 255, 0]);
    drawPoseLine(keypoints, "left_hip", "left_knee", [0, 255, 255]);
    drawPoseLine(keypoints, "left_knee", "left_ankle", [120, 255, 120]);
    drawPoseLine(keypoints, "right_hip", "right_knee", [255, 150, 0]);
    drawPoseLine(keypoints, "right_knee", "right_ankle", [255, 120, 120]);
    drawPoseLine(keypoints, "nose", "left_eye", [255, 180, 255]);
    drawPoseLine(keypoints, "nose", "right_eye", [255, 180, 255]);
    drawPoseLine(keypoints, "left_eye", "left_ear", [255, 180, 255]);
    drawPoseLine(keypoints, "right_eye", "right_ear", [255, 180, 255]);
    drawPoseLine(keypoints, "nose", "left_shoulder", [255, 120, 255]);
    drawPoseLine(keypoints, "nose", "right_shoulder", [255, 120, 255]);

    const orderedNames = [
      "nose", "left_eye", "right_eye", "left_ear", "right_ear",
      "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
      "left_wrist", "right_wrist", "left_hip", "right_hip",
      "left_knee", "right_knee", "left_ankle", "right_ankle"
    ];

    for (let i = 0; i < orderedNames.length; i++) {
      let kp = getKeypointByName(keypoints, orderedNames[i]);
      if (!isValidKeypoint(kp)) continue;

      let pt = poseToCanvas(kp);

      push();
      fill(220, 220, 220, 240);
      stroke(150);
      strokeWeight(2);
      ellipse(pt.x, pt.y, 30, 30);

      noStroke();
      fill(80);
      textAlign(CENTER, CENTER);
      textSize(14);
      text(i, pt.x, pt.y);
      pop();
    }
  }
}

function drawPoseLine(keypoints, nameA, nameB, col) {
  let a = getKeypointByName(keypoints, nameA);
  let b = getKeypointByName(keypoints, nameB);

  if (!isValidKeypoint(a) || !isValidKeypoint(b)) return;

  let pa = poseToCanvas(a);
  let pb = poseToCanvas(b);

  push();
  stroke(col[0], col[1], col[2]);
  strokeWeight(7);
  line(pa.x, pa.y, pb.x, pb.y);
  pop();
}

function getKeypointByName(keypoints, name) {
  for (let kp of keypoints) {
    if (kp.name === name || kp.part === name) return kp;
  }
  return null;
}

function isValidKeypoint(kp) {
  if (!kp) return false;
  let score = 1;
  if (kp.score !== undefined) score = kp.score;
  if (kp.confidence !== undefined) score = kp.confidence;
  return score > 0.2;
}

function poseToCanvas(kp) {
  return {
    x: map(kp.x, 0, video.width, width, 0),
    y: map(kp.y, 0, video.height, 0, height)
  };
}

function getPeople() {
  if (!segmentation || !segmentation.maskImageData) return [];

  let data = segmentation.maskImageData.data;
  let points = [];
  let step = 20;

  for (let i = 0; i < data.length; i += 4 * step) {
    if (data[i + 3] > 128) {
      let idx = i / 4;
      let x = idx % video.width;
      let y = floor(idx / video.width);
      points.push({ x, y });
    }
  }

  if (points.length === 0) return [];

  let clusters = [];
  let threshold = 250;

  for (let p of points) {
    let found = false;
    for (let c of clusters) {
      if (dist(p.x, p.y, c.x, c.y) < threshold) {
        c.x = (c.x * c.count + p.x) / (c.count + 1);
        c.y = (c.y * c.count + p.y) / (c.count + 1);
        c.count++;
        found = true;
        break;
      }
    }
    if (!found) clusters.push({ x: p.x, y: p.y, count: 1 });
  }

  let realPeople = clusters
    .sort((a, b) => b.count - a.count)
    .filter(c => c.count > 40);

  return realPeople.map(c => ({
    x: map(c.x, 0, video.width, width, 0),
    y: map(c.y, 0, video.height, 0, height)
  }));
}

function startInteraction(s, p) {
  s.state = "attached";
  s.target = p;
  s.img = s.species.img;

  activeInfo = {
    spirit: s,
    start: millis(),
    sentences: s.species.info,
    color: s.species.bubbleColor,
    x: p.x,
    y: p.y
  };
}

function updateInfo() {
  if (!activeInfo) return;

  if (activeInfo.spirit && activeInfo.spirit.target) {
    activeInfo.x = activeInfo.spirit.target.x;
    activeInfo.y = activeInfo.spirit.target.y;
  }

  if (millis() - activeInfo.start > INFO_TOTAL_DURATION) {
    activeInfo.spirit.state = "released";
    activeInfo.spirit.releaseStartTime = millis();
    activeInfo.spirit.target = null;
    activeInfo = null;
  }
}

function drawBubble() {
  if (!activeInfo) return;

  let t = millis() - activeInfo.start;
  let i = floor(t / SENTENCE_DURATION);
  i = constrain(i, 0, activeInfo.sentences.length - 1);

  let textStr = activeInfo.sentences[i];

  push();
  textSize(36);
  textAlign(CENTER, CENTER);
  textLeading(46);

  let lines = makeForcedTwoLineText(textStr, 420);
  let line1 = lines[0];
  let line2 = lines[1];

  let longest = max(textWidth(line1), textWidth(line2));
  let bubbleW = longest + 120;
  let bubbleH = 150;

  bubbleW = constrain(bubbleW, 320, 620);

  let bx = constrain(activeInfo.x, bubbleW / 2 + 20, width - bubbleW / 2 - 20);
  let by = max(activeInfo.y - 220, bubbleH / 2 + 20);

  fill(activeInfo.color[0], activeInfo.color[1], activeInfo.color[2], 220);
  noStroke();
  rectMode(CENTER);
  rect(bx, by, bubbleW, bubbleH, 24);

  triangle(
    bx - 24, by + bubbleH / 2 - 6,
    bx + 24, by + bubbleH / 2 - 6,
    bx,      by + bubbleH / 2 + 30
  );

  fill(255);
  text(line1, bx, by - 22);
  text(line2, bx, by + 22);

  pop();
}

function makeForcedTwoLineText(str, maxLineWidth = 420) {
  textSize(36);

  let words = str.split(" ");
  if (words.length <= 1) return [str, " "];

  let bestSplit = 1;
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    let line1 = words.slice(0, i).join(" ");
    let line2 = words.slice(i).join(" ");

    let w1 = textWidth(line1);
    let w2 = textWidth(line2);

    let penalty = 0;
    if (w1 > maxLineWidth) penalty += (w1 - maxLineWidth) * 10;
    if (w2 > maxLineWidth) penalty += (w2 - maxLineWidth) * 10;

    let balance = abs(w1 - w2);
    let score = penalty + balance;

    if (score < bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  let line1 = words.slice(0, bestSplit).join(" ");
  let line2 = words.slice(bestSplit).join(" ");

  return [line1, line2];
}

function moveAttached(s) {
  if (!s.target) return;
  s.x = lerp(s.x, s.target.x - 50, 0.1);
  s.y = lerp(s.y, s.target.y - 50, 0.1);
}

function moveReleased(s) {
  s.x += s.vx;
  s.y += s.vy;

  s.vx += random(-0.05, 0.05);
  s.vy += random(-0.05, 0.05);

  s.vx = constrain(s.vx, -4, 4);
  s.vy = constrain(s.vy, -4, 4);

  if (s.x <= 0 || s.x >= width - 100) s.vx *= -1;
  if (s.y <= 0 || s.y >= height - 100) s.vy *= -1;

  if (millis() - s.releaseStartTime > ANIMAL_OUTSIDE_DURATION) {
    s.state = "ghost";
    s.img = ghostImg;
    s.species = random(speciesData);
    s.vx = random(-1.5, 1.5);
    s.vy = random(-1.5, 1.5);
  }
}

function checkCollision(s) {
  if (!segmentation || !segmentation.maskImageData) return false;
  if (s.state !== "ghost") return false;

  let data = segmentation.maskImageData.data;
  let stepSize = 10;

  for (let x = s.x; x < s.x + 100; x += stepSize) {
    for (let y = s.y; y < s.y + 100; y += stepSize) {
      let vx = map(x, width, 0, 0, video.width);
      let vy = map(y, 0, height, 0, video.height);

      vx = floor(vx);
      vy = floor(vy);

      let index = (vy * video.width + vx) * 4;
      let alpha = data[index + 3];

      if (alpha > 128) return true;
    }
  }

  return false;
}

function getClosestPerson(s, people) {
  if (!people.length) return null;

  let closest = null;
  let minD = Infinity;

  for (let p of people) {
    let d = dist(s.x, s.y, p.x, p.y);
    if (d < minD) {
      minD = d;
      closest = p;
    }
  }
  return closest;
}

function drawPeopleCounter(n) {
  push();
  fill(255);
  noStroke();
  textSize(40);
  textAlign(LEFT, TOP);
  text("People: " + n, 50, 50);
  pop();
}

function drawCountdownTimer() {
  let elapsed = millis() - startTime;
  let remaining = max(0, RESET_TIME - elapsed);
  let secondsLeft = ceil(remaining / 1000);

  push();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  let tx = width / 2;
  let ty = height - 90;

  fill(0, 180);
  noStroke();
  rect(tx, ty, 760, 70, 15);

  fill(255);
  textSize(34);
  text(`RESET IN: ${secondsLeft} SECONDS`, tx, ty);
  pop();
}

function drawCropMarks() {
  push();
  stroke(255, 0, 0);
  strokeWeight(15);
  let len = 40;
  let pad = 20;

  line(pad, pad, pad + len, pad);
  line(pad, pad, pad, pad + len);

  line(width - pad, pad, width - pad - len, pad);
  line(width - pad, pad, width - pad, pad + len);

  line(pad, height - pad, pad + len, height - pad);
  line(pad, height - pad, pad, height - pad - len);

  line(width - pad, height - pad, width - pad - len, height - pad);
  line(width - pad, height - pad, width - pad, height - pad - len);
  pop();
}

function resetAll() {
  startTime = millis();
  activeInfo = null;

  for (let s of spirits) {
    s.state = "ghost";
    s.img = ghostImg;
    s.species = random(speciesData);
    s.target = null;
    s.releaseStartTime = 0;
    s.x = random(width - 100);
    s.y = random(height - 100);
    s.vx = random(-1.5, 1.5);
    s.vy = random(-1.5, 1.5);
  }
}

class Spirit {
  constructor(img, species) {
    this.img = img;
    this.species = species;
    this.x = 0;
    this.y = 0;
    this.state = "ghost";
    this.target = null;
    this.releaseStartTime = 0;
    this.vx = random(-1.5, 1.5);
    this.vy = random(-1.5, 1.5);
  }

  update() {
    if (this.state === "ghost") {
      this.x += this.vx;
      this.y += this.vy;

      if (random() < 0.02) {
        this.vx += random(-0.3, 0.3);
        this.vy += random(-0.3, 0.3);
      }

      this.vx = constrain(this.vx, -2.2, 2.2);
      this.vy = constrain(this.vy, -2.2, 2.2);

      if (this.x <= 0 || this.x >= width - 100) this.vx *= -1;
      if (this.y <= 0 || this.y >= height - 100) this.vy *= -1;
    }
  }

  display() {
    if (!this.img) return;
    image(this.img, this.x, this.y, 100, 100);
  }
}