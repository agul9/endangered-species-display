// =========================
// FULL UPDATED sketch.js
// segmentation-center + simple skeleton version
// animal scale by species
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
let oceanBg;
let constructionBg;

let bgBuffer;
let ghostImg;

let spirits = [];
const GHOST_COUNT = 30;

let speciesData = [];
let activeInfo = [null,null];

let startTime;

let personModes = []; // [{x, y, mode: "grass" | "ocean"}]
let maxNumOfCollisions = 2;
let peopleCollided;
const PERSON_MODE_SMOOTH_DIST = 220;
const PERSON_CIRCLE_RADIUS = 200;

// segmentation clustering
const SEGMENT_SAMPLE_STEP = 10;
const SEGMENT_CLUSTER_DIST = 400;
const SEGMENT_MIN_CLUSTER_SIZE = 40;

// animal size
const GHOST_SIZE = 60;
const ANIMAL_BASE_SIZE = 220;

function preload() {
  ghostImg = loadImage("assets/animals/ghost.png");
  prettyBg = loadImage("assets/grass.jpg");
  oceanBg = loadImage("assets/animals/ocean.jpg");
  constructionBg = loadImage("assets/construction.png");

  let northAtlanticRightWhaleImg = loadImage("assets/animals/northAtlanticRightWhale.png");
  let gopherTortoiseImg = loadImage("assets/animals/gopherTortoise.png");
  let redCockadedWoodpeckerImg = loadImage("assets/animals/RedCockadedWoodpecker.png");
  let westIndianManateeImg = loadImage("assets/animals/WestIndianManatee.png");
  let loggerHeadSeaTurtleImg = loadImage("assets/animals/LoggerHeadSeaTurtle.png");
  let woodStorkImg = loadImage("assets/animals/WoodStork.png");
  let etowahDarterImg = loadImage("assets/animals/EtowahDarter.png");

  speciesData = [
    {
      img: northAtlanticRightWhaleImg,
      habitat: "marine",
      scale: 9.10, // biggest
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
      habitat: "land",
      scale: 1.5,
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
      habitat: "land",
      scale: 0.5, // small bird
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
      habitat: "marine",
      scale: 1.9,
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
      habitat: "marine",
      scale: 2.7,
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
      habitat: "land",
      scale: 1.8, // medium bird
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
      habitat: "marine",
      scale: 0.5, // small fish
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

  peopleCollided = 0; 

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  bgBuffer = createGraphics(width, height);

  bodySegmentation.detectStart(video, (res) => {
    segmentation = res;
  });

  bodyPose = ml5.bodyPose("MoveNet", {
    modelType: "SINGLEPOSE_LIGHTNING"
  });
  bodyPose.detectStart(video, (res) => {
    poses = res;
  });

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

  let people = getPeopleFromSegmentation();
  updatePersonModes(people);

  drawPersonTextureCircles();
  drawDigitalSkeletonsSimple();

  // Flag to prevent multiple ghosts grabbing the same person in one frame
  let personClaimedThisFrame = []; 

  for (let s of spirits) {
    s.update();

    if (s.state === "ghost") {
      let emptySlotIndex = activeInfo.indexOf(null);

      // Only check collisions if there is room for a new animal
      if (emptySlotIndex !== -1 && checkCollisionWithPeopleCircles(s, personModes)) {
        let p = getClosestEligiblePerson(s, personModes);
        
        if (p) {
          // --- BUSY CHECK ---
          let personIsBusy = false;
          
          // Check if person is already in a slot
          for (let info of activeInfo) {
            if (info && info.spirit && info.spirit.target) {
              if (dist(p.x, p.y, info.spirit.target.x, info.spirit.target.y) < 400) {
                personIsBusy = true;
                break;
              }
            }
          }

          // Check if another ghost JUST grabbed this person this frame
          for (let claimedP of personClaimedThisFrame) {
            if (dist(p.x, p.y, claimedP.x, claimedP.y) < 200) {
              personIsBusy = true;
              break;
            }
          }

          if (!personIsBusy) { 
            personClaimedThisFrame.push(p);
            startInteraction(s, p); 
          }
        }
      }
    }

    if (s.state === "attached") moveAttached(s);
    if (s.state === "released") moveReleased(s);

    s.display();
  }

  // Draw UI elements
  showInfoPanel();
  updateInfo();
  drawBubble();

  drawPeopleCounter(people.length);
  drawCountdownTimer();
  drawCropMarks();
}

// --- UPDATED START INTERACTION ---
function startInteraction(s, p) {
  let slotIndex = activeInfo.indexOf(null);
  if (slotIndex !== -1) {
    s.state = "attached";
    s.target = p;
    s.img = s.species.img;

    activeInfo[slotIndex] = {
      spirit: s,
      start: millis(),
      sentences: s.species.info,
      color: s.species.bubbleColor,
      x: p.x,
      y: p.y
    };
    recalculateCollisions();
  }
}

// --- UPDATED UPDATE INFO (Safely clears targets) ---
function updateInfo() {
  for (let i = 0; i < activeInfo.length; i++) {
    let info = activeInfo[i];
    if (!info) continue;

    if (info.spirit && info.spirit.target) {
      info.x = info.spirit.target.x;
      info.y = info.spirit.target.y;
    }

    if (millis() - info.start > INFO_TOTAL_DURATION) {
      if (info.spirit) {
        info.spirit.state = "released";
        info.spirit.releaseStartTime = millis();
        info.spirit.target = null;
      }
      activeInfo[i] = null; 
      recalculateCollisions();
    }
  }
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

function getPeopleFromSegmentation() {
  if (!segmentation || !segmentation.maskImageData) return [];

  let data = segmentation.maskImageData.data;
  let points = [];

  for (let y = 0; y < video.height; y += SEGMENT_SAMPLE_STEP) {
    for (let x = 0; x < video.width; x += SEGMENT_SAMPLE_STEP) {
      let idx = (y * video.width + x) * 4;
      let alpha = data[idx + 3];

      if (alpha > 50) {
        points.push({ x, y });
      }
    }
  }

  if (points.length === 0) return [];

  let clusters = [];

  for (let p of points) {
    let found = false;

    for (let c of clusters) {
      if (dist(p.x, p.y, c.x, c.y) < SEGMENT_CLUSTER_DIST) {
        c.x = (c.x * c.count + p.x) / (c.count + 1);
        c.y = (c.y * c.count + p.y) / (c.count + 1);
        c.count++;
        found = true;
        break;
      }
    }

    if (!found) {
      clusters.push({
        x: p.x,
        y: p.y,
        count: 1
      });
    }
  }

  let realPeople = clusters.filter(c => c.count >= SEGMENT_MIN_CLUSTER_SIZE);

  return realPeople.map(c => ({
    x: map(c.x, 0, video.width, width, 0),
    y: map(c.y, 0, video.height, 0, height)
  }));
}

function updatePersonModes(people) {
  let updated = [];

  for (let p of people) {
    let matched = null;
    let minD = Infinity;

    for (let old of personModes) {
      let d = dist(p.x, p.y, old.x, old.y);
      if (d < PERSON_MODE_SMOOTH_DIST && d < minD) {
        minD = d;
        matched = old;
      }
    }

    if (matched) {
      updated.push({
        x: p.x,
        y: p.y,
        mode: matched.mode
      });
    } else {
      updated.push({
        x: p.x,
        y: p.y,
        mode: random() < 0.5 ? "grass" : "ocean"
      });
    }
  }

  personModes = updated;
}

function drawPersonTextureCircles() {
  for (let p of personModes) {
    push();

    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.arc(p.x, p.y, PERSON_CIRCLE_RADIUS, 0, TWO_PI);
    drawingContext.clip();

    if (p.mode === "grass") {
      image(
        prettyBg,
        p.x - PERSON_CIRCLE_RADIUS,
        p.y - PERSON_CIRCLE_RADIUS,
        PERSON_CIRCLE_RADIUS * 2,
        PERSON_CIRCLE_RADIUS * 2
      );
    } else {
      image(
        oceanBg,
        p.x - PERSON_CIRCLE_RADIUS,
        p.y - PERSON_CIRCLE_RADIUS,
        PERSON_CIRCLE_RADIUS * 2,
        PERSON_CIRCLE_RADIUS * 2
      );
    }

    drawingContext.restore();

    //stroke(255, 160);
    //strokeWeight(4);
    noStroke();
    noFill();
    ellipse(p.x, p.y, PERSON_CIRCLE_RADIUS * 2, PERSON_CIRCLE_RADIUS * 2);

    pop();
  }
}

function drawDigitalSkeletonsSimple() {
  if (!poses || poses.length === 0) return;

  for (let pose of poses) {
    let keypoints = pose.keypoints || [];
    if (!keypoints.length) continue;

    drawPoseLineSimple(keypoints, "left_shoulder", "right_shoulder");
    drawPoseLineSimple(keypoints, "left_shoulder", "left_elbow");
    drawPoseLineSimple(keypoints, "left_elbow", "left_wrist");
    drawPoseLineSimple(keypoints, "right_shoulder", "right_elbow");
    drawPoseLineSimple(keypoints, "right_elbow", "right_wrist");
    drawPoseLineSimple(keypoints, "left_shoulder", "left_hip");
    drawPoseLineSimple(keypoints, "right_shoulder", "right_hip");
    drawPoseLineSimple(keypoints, "left_hip", "right_hip");
    drawPoseLineSimple(keypoints, "left_hip", "left_knee");
    drawPoseLineSimple(keypoints, "left_knee", "left_ankle");
    drawPoseLineSimple(keypoints, "right_hip", "right_knee");
    drawPoseLineSimple(keypoints, "right_knee", "right_ankle");

    let simplePoints = [
      "nose",
      "left_shoulder", "right_shoulder",
      "left_elbow", "right_elbow",
      "left_wrist", "right_wrist",
      "left_hip", "right_hip",
      "left_knee", "right_knee",
      "left_ankle", "right_ankle"
    ];

    for (let name of simplePoints) {
      let kp = getKeypointByName(keypoints, name);
      if (!isValidKeypoint(kp)) continue;

      let pt = poseToCanvas(kp);

      push();
      noStroke();
      fill(255, 220);
      ellipse(pt.x, pt.y, 16, 16);
      pop();
    }
  }
}

function drawPoseLineSimple(keypoints, nameA, nameB) {
  let a = getKeypointByName(keypoints, nameA);
  let b = getKeypointByName(keypoints, nameB);

  if (!isValidKeypoint(a) || !isValidKeypoint(b)) return;

  let pa = poseToCanvas(a);
  let pb = poseToCanvas(b);

  push();
  stroke(255, 210);
  strokeWeight(5);
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

function checkCollisionWithPeopleCircles(s, peopleWithModes) {
  if (!peopleWithModes || peopleWithModes.length === 0) return false;
  if (s.state !== "ghost") return false;

  let spiritCenterX = s.x + GHOST_SIZE / 2;
  let spiritCenterY = s.y + GHOST_SIZE / 2;

  for (let p of peopleWithModes) {
    let d = dist(spiritCenterX, spiritCenterY, p.x, p.y);
    if (d < PERSON_CIRCLE_RADIUS + GHOST_SIZE / 2) {
      return true;
    }
  }

  return false;
}

function getClosestEligiblePerson(s, peopleWithModes) {
  if (!peopleWithModes.length) return null;

  let wantedMode = s.species.habitat === "marine" ? "ocean" : "grass";

  let closest = null;
  let minD = Infinity;

  for (let p of peopleWithModes) {
    if (p.mode !== wantedMode) continue;

    let d = dist(s.x + GHOST_SIZE / 2, s.y + GHOST_SIZE / 2, p.x, p.y);
    if (d < minD) {
      minD = d;
      closest = p;
    }
  }

  return closest;
}

// Helper function to keep our count honest
function recalculateCollisions() {
  let count = 0;
  for (let slot of activeInfo) {
    if (slot !== null) count++;
  }
  peopleCollided = count;
}

function drawBubble() {
  // Now we loop through the two slots in the array
  for (let info of activeInfo) {
    // Skip the slot if it's empty (null)
    if (!info) continue;

    let t = millis() - info.start;
    let i = floor(t / SENTENCE_DURATION);
    
    // Safety check for the sentence index
    i = constrain(i, 0, info.sentences.length - 1);

    let textStr = info.sentences[i];

    push();
    textSize(36);
    textAlign(CENTER, CENTER);
    textLeading(46);

    let lines = makeForcedTwoLineText(textStr, 420);
    let line1 = lines[0];
    let line2 = lines[1];

    let longest = max(textWidth(line1), textWidth(line2));
    let bubbleW = constrain(longest + 120, 320, 620);
    let bubbleH = 150;

    // Use the coordinates of the specific animal/person for this slot
    let bx = constrain(info.x, bubbleW / 2 + 20, width - bubbleW / 2 - 20);
    let by = max(info.y - 260, bubbleH / 2 + 20);

    // Draw bubble tail
    fill(info.color[0], info.color[1], info.color[2], 220);
    noStroke();
    triangle(
      bx - 24, by + bubbleH / 2 - 6,
      bx + 24, by + bubbleH / 2 - 6,
      bx,      by + bubbleH / 2 + 30
    );

    // Draw bubble body
    rectMode(CENTER);
    rect(bx, by, bubbleW, bubbleH, 24);

    // Draw text
    fill(255);
    text(line1, bx, by - 22);
    text(line2, bx, by + 22);
    pop();
  }
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
  // 1. Find the person in the current 'personModes' list that is closest to where the spirit is
  let closestP = null;
  let minDist = 500; // Only look within a reasonable range

  for (let p of personModes) {
    let d = dist(s.x + (ANIMAL_BASE_SIZE * s.species.scale)/2, 
                 s.y + (ANIMAL_BASE_SIZE * s.species.scale)/2, 
                 p.x, p.y);
    if (d < minDist) {
      minDist = d;
      closestP = p;
    }
  }

  // 2. If we found them, update the target and move
  if (closestP) {
    s.target = closestP; // Keep the reference fresh
    
    let scale = s.species.scale || 1.0;
    let w = ANIMAL_BASE_SIZE * scale;
    let h = ANIMAL_BASE_SIZE * scale;

    // Hard-lock the position to the center of the circle
    s.x = closestP.x - w / 2;
    s.y = closestP.y - h / 2;
  }
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

function drawPeopleCounter(n) {
  push();
  fill(0);
  noStroke();
  textSize(50);
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

function showInfoPanel() {
  // We loop through our 2 slots
  for (let i = 0; i < activeInfo.length; i++) {
    let info = activeInfo[i];
    
    // Position logic: Slot 0 (Left), Slot 1 (Right)
    let x = (i === 0) ? 80 : width - 680; 
    let y = 100;
    let w = 600;
    let h = 350;

    if (info) {
      // --- DRAW THE ACTIVE PANEL ---
      let species = info.spirit.species;
      
      push();
      // Background Box
      fill(0, 180);
      stroke(info.color);
      strokeWeight(4);
      rect(x, y, w, h, 20);
      
      // Species Name
      noStroke();
      fill(info.color);
      textSize(45);
      text(species.info[0], x + 30, y + 60);
      
      // Habitat Info
      fill(255);
      textSize(25);
      text("REGION: Georgia, USA", x + 30, y + 110);
      text("HABITAT: " + species.habitat.toUpperCase(), x + 30, y + 145);
      
      // Big Animal Image
      imageMode(CENTER);
      image(species.img, x + w/2, y + 240, 200, 200);
      pop();

    }
  }
}

function resetAll() {
  startTime = millis();
  activeInfo = [null,null];
  personModes = [];

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

    if (this.state === "ghost") {
      push();
      tint(255,150);
      image(this.img, this.x, this.y, GHOST_SIZE, GHOST_SIZE);
      pop();
    } else {
      let scale = this.species.scale || 1.0;
      let w = ANIMAL_BASE_SIZE * scale;
      let h = ANIMAL_BASE_SIZE * scale;

      image(this.img, this.x, this.y, w, h);
    }
  }
}