// =========================
// FULL UPDATED sketch.js
// silhouette texture + sequential panel text
// =========================

const INFO_TOTAL_DURATION = 18000;
const SENTENCE_DURATION = 5500;
const ANIMAL_OUTSIDE_DURATION = 15000;
const RESET_TIME = 60000;

let video;
let bodySegmentation;
let segmentation;

let maskBuf, tempG, bigGrassMask, bigOceanMask;

let silhouetteTrailBuffer;

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
let activeInfo = [null, null];

let startTime;

let personModes = [];
let maxNumOfCollisions = 2;
let peopleCollided;

const PERSON_MODE_SMOOTH_DIST = 220;
const PERSON_CIRCLE_RADIUS = 150; // 200 for laptop, 150 for bridge

const SEGMENT_SAMPLE_STEP = 10;
const SEGMENT_CLUSTER_DIST = 300; // 300 for bridge, 450 for laptop
const SEGMENT_MIN_CLUSTER_SIZE = 15; // change to 15 when testing on bridge, 150 for laptop

const GHOST_SIZE = 60;
const ANIMAL_BASE_SIZE = 220;

function preload() {
  ghostImg = loadImage("assets/animals/ghost.png");
  prettyBg = loadImage("assets/grass.jpg");
  oceanBg = loadImage("assets/animals/ocean.jpg");
  constructionBg = loadImage("assets/construction.png");

  let northAtlanticRightWhaleImg = loadImage("assets/animals/northAtlanticRightWhale.png");
  let gopherTortoiseImg = loadImage("assets/animals/tortoise2.gif");
  let redCockadedWoodpeckerImg = loadImage("assets/animals/woodpecker2.gif");
  let westIndianManateeImg = loadImage("assets/animals/WestIndianManatee.png");
  let loggerHeadSeaTurtleImg = loadImage("assets/animals/sea turtle3.gif");
  let woodStorkImg = loadImage("assets/animals/stork.gif");
  let etowahDarterImg = loadImage("assets/animals/fish.gif");

  speciesData = [
    {
      img: northAtlanticRightWhaleImg,
      habitat: "marine",
      scale: 9.10,
      bubbleColor: [70, 110, 190],
      name: "North Atlantic Right Whale",
      info: [
        "\"Hi! I'm the North Atlantic Right Whale.\"",
        "I live in the coastal waters of Georgia during the winter to have my calves.",
        "I'm endangered because of vessel strikes and entanglement in fishing gear.",
        "Only about 380 of me are left in the entire world."
      ]
    },
    {
      img: gopherTortoiseImg,
      habitat: "land",
      name: "Gopher Tortoise",
      scale: 1.5,
      bubbleColor: [181, 126, 62],
      info: [
        "\"Hi! I'm the Gopher Tortoise.\"",
        "I live in the sandy pine forests of Southern Georgia.",
        "I'm endangered because of habitat loss due to development and lack of prescribed fires.",
        "About 65 viable populations are now permanently protected in Georgia."
      ]
    },
    {
      img: redCockadedWoodpeckerImg,
      habitat: "land",
      name: "Red-cockaded Woodpecker",
      scale: 0.5,
      bubbleColor: [176, 63, 63],
      info: [
        "\"Hi! I'm the Red-cockaded Woodpecker.\"",
        "I live in old-growth pine forests in Middle and South Georgia.",
        "I'm endangered because I can only nest in living pine trees, which are being cut down.",
        "About 800 to 1,000 clusters are left in Georgia."
      ]
    },
    {
      img: westIndianManateeImg,
      habitat: "marine",
      name: "West Indian Manatee",
      scale: 1.9,
      bubbleColor: [74, 145, 134],
      info: [
        "\"Hi! I'm the West Indian Manatee.\"",
        "I live in coastal rivers and estuaries during the warm summer months.",
        "I'm endangered because of collisions with watercraft.",
        "Several hundred of us visit Georgia's waters each year."
      ]
    },
    {
      img: loggerHeadSeaTurtleImg,
      habitat: "marine",
      name: "Loggerhead Sea Turtle",
      scale: 2.7,
      bubbleColor: [88, 140, 86],
      info: [
        "\"Hi! I'm the Loggerhead Sea Turtle.\"",
        "I live on Georgia's barrier island beaches to lay my eggs.",
        "I'm endangered because of beachfront lighting and accidental capture in nets.",
        "We had over 3,000 nests recorded in Georgia recently."
      ]
    },
    {
      img: woodStorkImg,
      habitat: "land",
      name: "Wood Stork",
      scale: 1.8,
      bubbleColor: [120, 120, 120],
      info: [
        "\"Hi! I'm the Wood Stork.\"",
        "I live in the swamps and marshes of South Georgia.",
        "I'm endangered because of the destruction of wetlands.",
        "About 2,500 to 3,000 nesting pairs are left in Georgia."
      ]
    },
    {
      img: etowahDarterImg,
      habitat: "marine",
      name: "Etowah Darter",
      scale: 0.5,
      bubbleColor: [140, 88, 170],
      info: [
        "\"Hi! I'm the Etowah Darter.\"",
        "I live exclusively in the Etowah River Basin in North Georgia.",
        "I'm endangered because of water pollution and urban runoff.",
        "I am found in only a few small creek sections."
      ]
    }
  ];

  bodySegmentation = ml5.bodySegmentation("BodyPix", {
    maskType: "body", 
    architecture: 'MobileNetV1', 
    outputStride: 16, 
    multiplier: 0.75, 
    quantBytes: 2
  });
}

function setup() {
  createCanvas(3072, 1280);
  pixelDensity(1);

  peopleCollided = 0;

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  maskBuf = createGraphics(640, 480);
  maskBuf.pixelDensity(1);
  
  tempG = createGraphics(width, height);
  tempG.pixelDensity(1);

  bgBuffer = createGraphics(width, height);

  silhouetteTrailBuffer = createGraphics(width, height);
  silhouetteTrailBuffer.pixelDensity(1); // <--- THIS FIXES THE CORNER ISSUE
  silhouetteTrailBuffer.clear();

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

  drawPersonTextureSilhouettes();

  // --- ADD THIS LOOP HERE ---
  if (poses && poses.length > 0) {
    for (let pose of poses) {
      drawSkeletonSilhouette(pose); 
    }
  }

  drawDigitalSkeletonsSimple();

  let personClaimedThisFrame = [];

  for (let s of spirits) {
    s.update();

    if (s.state === "ghost") {
      let emptySlotIndex = activeInfo.indexOf(null);

      if (emptySlotIndex !== -1 && checkCollisionWithPeopleCircles(s, personModes)) {
        let p = getClosestEligiblePerson(s, personModes);

        if (p) {
          let personIsBusy = false;

          for (let info of activeInfo) {
            if (info && info.spirit && info.spirit.target) {
              // maybe change to 600 on bridge if ppl are getting multiple animals
              if (dist(p.x, p.y, info.spirit.target.x, info.spirit.target.y) < 400) {
                personIsBusy = true;
                break;
              }
            }
          }

          for (let claimedP of personClaimedThisFrame) {
            // maybe change to 600 on bridge if ppl are getting multiple animals
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

  showInfoPanel();
  updateInfo();

  drawPeopleCounter(people.length);
  drawCountdownTimer();
  drawCropMarks();
}

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
  // BodyPix uses .data instead of .maskImageData
  if (!segmentation || !segmentation.data) return [];

  let points = [];
  
  // Use a smaller step (8 or 10) for better detail on the bridge
  let step = 10; 

  for (let y = 0; y < video.height; y += step) {
    for (let x = 0; x < video.width; x += step) {
      let index = y * video.width + x;
      let pixelValue = segmentation.data[index];

      // In BodyPix, -1 is background, 0 and up is a person
      if (pixelValue !== -1) { 
        points.push({ x, y });
      }
    }
  }

  if (points.length === 0) return [];

  let clusters = [];
  for (let p of points) {
    let found = false;
    for (let c of clusters) {
      // Keep this around 200-300 so people don't "merge" on the bridge
      if (dist(p.x, p.y, c.x, c.y) < SEGMENT_CLUSTER_DIST) {
        c.x = (c.x * c.count + p.x) / (c.count + 1);
        c.y = (c.y * c.count + p.y) / (c.count + 1);
        c.count++;
        found = true;
        break;
      }
    }
    if (!found) {
      clusters.push({ x: p.x, y: p.y, count: 1 });
    }
  }

  // Set SEGMENT_MIN_CLUSTER_SIZE to a low number (like 10 or 15) 
  // since people far away occupy fewer "points"
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
    let minD = 500; // Look in a wide radius to find the "old" you

    for (let old of personModes) {
      let d = dist(p.x, p.y, old.x, old.y);
      if (d < minD) {
        minD = d;
        matched = old;
      }
    }

    if (matched) {
      // Keep the same mode (grass/water) you already had!
      updated.push({
        x: p.x,
        y: p.y,
        mode: matched.mode 
      });
      
      // Remove the matched person from personModes so two clusters 
      // don't "steal" the same identity in one frame
      let idx = personModes.indexOf(matched);
      personModes.splice(idx, 1);
      
    } else {
      // ONLY if we can't find a match, create a new person
      updated.push({
        x: p.x,
        y: p.y,
        mode: random() < 0.5 ? "grass" : "ocean"
      });
    }
  }

  personModes = updated;
}

// =========================
// PERSON SILHOUETTE TEXTURE
// 원형 대신 사람 실루엣 모양으로 grass/ocean texture 표시
// =========================

function drawPersonTextureSilhouettes() {
  if (!segmentation || !segmentation.maskImageData) return;

  // 1. Update the mask
  maskBuf.clear();
  let maskData = segmentation.maskImageData.data;
  maskBuf.loadPixels();
  for (let i = 0; i < maskData.length; i += 4) {
    maskBuf.pixels[i] = 255;
    maskBuf.pixels[i + 1] = 255;
    maskBuf.pixels[i + 2] = 255;
    maskBuf.pixels[i + 3] = maskData[i + 3];
  }
  maskBuf.updatePixels();

  // 2. Prepare tempG (The Cookie Cutter)
  tempG.clear();
  tempG.push();
  tempG.translate(width, 0);
  tempG.scale(-1, 1);
  tempG.image(maskBuf, 0, 0, width, height); 
  
  // Use 'source-in' to make sure the grass only appears in the white mask
  tempG.drawingContext.globalCompositeOperation = 'source-in';
  
  let currentMode = (personModes.length > 0) ? personModes[0].mode : "grass";
  let tex = (currentMode === "ocean") ? oceanBg : prettyBg;
  tempG.image(tex, 0, 0, width, height);
  tempG.pop();

  // 3. The Trail Fix (No more fading to black!)
  silhouetteTrailBuffer.push();
  // This "eats" the old trail pixels slowly without adding black color
  silhouetteTrailBuffer.drawingContext.globalCompositeOperation = 'destination-out';
  silhouetteTrailBuffer.fill(255, 60); // 60 is the trail length. Higher = shorter trail.
  silhouetteTrailBuffer.rect(0, 0, width, height);
  
  // Switch back to normal to draw the new silhouette
  silhouetteTrailBuffer.drawingContext.globalCompositeOperation = 'source-over';
  silhouetteTrailBuffer.image(tempG, 0, 0);
  silhouetteTrailBuffer.pop();

  // 4. Draw to main screen
  image(silhouetteTrailBuffer, 0, 0);
}

function getClosestPersonMode(x, y) {
  if (!personModes || personModes.length === 0) return null;

  let closest = null;
  let minD = Infinity;

  for (let p of personModes) {
    let d = dist(x, y, p.x, p.y);
    if (d < minD) {
      minD = d;
      closest = p;
    }
  }

  return closest;
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
  if (s.state !== "ghost") return false;

  let spiritCenterX = s.x + GHOST_SIZE / 2;
  let spiritCenterY = s.y + GHOST_SIZE / 2;

  // 1. First, check if we hit a Skeleton (More accurate)
  if (poses && poses.length > 0) {
    for (let pose of poses) {
      let nose = getKeypointByName(pose.keypoints, "nose");
      if (isValidKeypoint(nose)) {
        let pt = poseToCanvas(nose);
        let d = dist(spiritCenterX, spiritCenterY, pt.x, pt.y);
        
        // If animal hits the head/torso area
        if (d < 180) { 
          return true; 
        }
      }
    }
  }

  // 2. Fallback: Check the segmentation circles (In case skeleton isn't fully loaded)
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

function recalculateCollisions() {
  let count = 0;

  for (let slot of activeInfo) {
    if (slot !== null) count++;
  }

  peopleCollided = count;
}

function moveAttached(s) {
  // Use the last known position as the default target so it doesn't jump to (0,0)
  let targetX = s.x + (ANIMAL_BASE_SIZE * (s.species.scale || 1.0)) / 2;
  let targetY = s.y + (ANIMAL_BASE_SIZE * (s.species.scale || 1.0)) / 2;
  let foundSomeone = false;

  // 1. Check Poses (MoveNet) - Priority 1
  if (poses && poses.length > 0) {
    let pose = poses[0];
    let nose = getKeypointByName(pose.keypoints, "nose");
    if (isValidKeypoint(nose)) {
      let pt = poseToCanvas(nose);
      targetX = pt.x;
      targetY = pt.y;
      foundSomeone = true;
    }
  }

  // 2. Check Clusters (BodyPix) - Fallback
  if (!foundSomeone && personModes.length > 0) {
    let closestP = getClosestPersonMode(s.x, s.y);
    if (closestP) {
      // ONLY follow if the person is within a reasonable distance (e.g. 600px)
      // This stops the animal from flying across the screen to "ghost" noise
      if (dist(s.x, s.y, closestP.x, closestP.y) < 600) {
        targetX = closestP.x;
        targetY = closestP.y;
        foundSomeone = true;
      }
    }
  }

  // 3. Move the animal ONLY if someone was actually found
  if (foundSomeone) {
    let scale = s.species.scale || 1.0;
    let w = ANIMAL_BASE_SIZE * scale;
    let h = ANIMAL_BASE_SIZE * scale;

    // We LERP toward the center of the person
    s.x = lerp(s.x, targetX - w / 2, 0.15);
    s.y = lerp(s.y, targetY - h / 2, 0.15);
  } else {
    // If no one is found, the animal stays put! No jumping.
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

function drawSkeletonSilhouette(pose) {
  let keypoints = pose.keypoints;
  push();
  
  // A soft, digital "glow" for the social justice theme
  fill(255, 255, 255, 40); 
  noStroke();
  
  // 1. Draw Head
  let nose = getKeypointByName(keypoints, "nose");
  if (isValidKeypoint(nose)) {
    let pt = poseToCanvas(nose);
    ellipse(pt.x, pt.y - 20, 100, 130); 
  }

  // 2. Draw Torso
  let lS = getKeypointByName(keypoints, "left_shoulder");
  let rS = getKeypointByName(keypoints, "right_shoulder");
  let lH = getKeypointByName(keypoints, "left_hip");
  let rH = getKeypointByName(keypoints, "right_hip");

  if (isValidKeypoint(lS) && isValidKeypoint(rS) && isValidKeypoint(lH) && isValidKeypoint(rH)) {
    let pLS = poseToCanvas(lS);
    let pRS = poseToCanvas(rS);
    let pLH = poseToCanvas(lH);
    let pRH = poseToCanvas(rH);
    
    beginShape();
    vertex(pLS.x, pLS.y);
    vertex(pRS.x, pRS.y);
    vertex(pRH.x, pRH.y);
    vertex(pLH.x, pLH.y);
    endShape(CLOSE);
  }
  pop();
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
  for (let i = 0; i < activeInfo.length; i++) {
    let info = activeInfo[i];

    let x = i === 0 ? 80 : width - 680;
    let y = 100;
    let w = 600;
    let h = 600;

    if (info) {
      let species = info.spirit.species;

      let t = millis() - info.start;
      let sentenceIndex = floor(t / SENTENCE_DURATION);
      sentenceIndex = constrain(sentenceIndex, 0, species.info.length - 1);

      let currentSentence = species.info[sentenceIndex];

      push();

      fill(0, 180);
      stroke(info.color);
      strokeWeight(4);
      rect(x, y, w, h, 20);

      noStroke();
      fill(info.color);
      textAlign(CENTER, TOP);
      textSize(50);
      textStyle(BOLD);
      text(species.name, x + 30, y + 40, w - 50);

      // fill(255);
      // textSize(30);
      // textStyle(NORMAL);
      // text("REGION: Georgia, USA", x + 30, y + 210);
      // text("HABITAT: " + species.habitat.toUpperCase(), x + 30, y + 250);

      // fill(255);
      // textSize(32);
      // textStyle(BOLD);
      // text("ANIMAL MESSAGE", x + 30, y + 330);

      fill(255);
      textSize(40);
      textStyle(NORMAL);
      textAlign(CENTER);
      textLeading(42);
      text(currentSentence, x + 30, y + 210, w - 50, 260);

      pop();
    }
  }
}

function resetAll() {
  startTime = millis();
  activeInfo = [null, null];
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
      tint(255, 150);
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