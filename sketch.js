// to do: 
// 1. done - fix so it works with multiple people (redo center calculation)
// 2. done - make the mask stuff slower - like the opacity slowly fades in / out as the person is detected instead of being so harsh
// 3. add skeleton / outline to person OR add like a counter 'x people detected'
// 4. done - add crop marks in corners
// 5. change bg to something more meaningful - maybe gt land area before gt was built ? 
// 6. done - why is the text always showing now, it should only show when there is a collision ?

// hello
// variables for nature bg
let tempBuffer;
let finalImg;

// variables for camera bw bg
let bgBuffer;

let currentFade = 0; // The actual opacity being drawn
let video;
let prettyBg, constructionBg;
let animals = [];
let bodySegmentation;
let segmentation;
let options = { maskType: "background" };
let sparrowImg;
let seaTurtle;

// NEW: pose detection
let bodyPose;
let poses = [];

// Population & Message
let remainingPopulation = 100;
let messageText = "";
let messageTimer = 0;

let prettyScaled;

// Reset timer
let startTime;
const RESET_TIME = 60000; // 1 minute in milliseconds

function preload() {
  // Check path: assets -> animals -> sparrow.png
  sparrowImg = loadImage("assets/animals/sparrow.png"); 
  seaTurtle = loadImage("assets/animals/seaTurtle.png"); 
  prettyBg = loadImage("assets/grass.jpg");
  constructionBg = loadImage("assets/construction.png");

  bodySegmentation = ml5.bodySegmentation("SelfieSegmentation", options);
}

function setup() {
  createCanvas(3072, 1280);

  startTime = millis();
  
  tempBuffer = createGraphics(width, height);
  finalImg = createImage(width, height);
  
  bgBuffer = createGraphics(width, height);
  
  // Pre-draw the nature texture to the canvas size
  prettyScaled = createGraphics(width, height);
  prettyScaled.image(prettyBg, 0, 0, width, height);

  // Create animals and place them randomly at the start
  for (let i = 0; i < 15; i++) {
    let a;
    if (i < 8) {
      a = new Animal(sparrowImg, random(1.2, 2.0));
    } else {
      a = new Animal(seaTurtle, random(1.2, 2.0));
    }

    a.w = random(100, 150);
    a.h = a.w;

    a.x = random(width);
    a.y = random(height);

    a.state = "free";
    a.target = null;

    animals.push(a);
  }

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // segmentation
  bodySegmentation.detectStart(video, gotResults);

  // NEW: pose detection
  bodyPose = ml5.bodyPose("MoveNet", {
    modelType: "MULTIPOSE_LIGHTNING"
  });
  bodyPose.detectStart(video, gotPoses);

  textAlign(CENTER, CENTER);
  textFont("Courier New");
}

function draw() {
  // Reset every 1 minute
  if (millis() - startTime >= RESET_TIME) {
    resetExperience();
  }

  // Draw camera bg in BW filter
  if (video.loadedmetadata) {
    bgBuffer.clear();
    bgBuffer.push();
    bgBuffer.translate(width, 0);
    bgBuffer.scale(-1, 1);
    bgBuffer.image(video, 0, 0, width, height);
    bgBuffer.pop();
    bgBuffer.filter(GRAY);
    image(bgBuffer, 0, 0);
  }

  // Draw smooth silhouette with nature texture
  drawPrettySilhouetteSmooth();

  // NEW: draw digital skeletons
  drawDigitalSkeletons();

  let detectedPeople = getPeople();

  for (let a of animals) {
    if (a.update) {
      a.update();
    }

    // Free movement
    if (a.state === "free") {
      if (checkCollision(a)) {
        messageText = `${remainingPopulation} Cape Sable seaside sparrows are saved`;
        messageTimer = 120; // Show for ~2 seconds

        let closest = null;
        let minD = Infinity;
  
        for (let p of detectedPeople) {
          let d = dist(
            a.x + a.w / 2,
            a.y + a.h / 2,
            p.x,
            p.y
          );

          if (d < minD) {
            minD = d;
            closest = p;
          }
        }

        if (closest) {
          a.state = "captured";
          a.target = closest;
        }
      }
    }

    // Captured movement
    if (a.state === "captured") {
      let closest = null;
      let minD = Infinity;

      for (let p of detectedPeople) {
        let d = dist(a.x + a.w / 2, a.y + a.h / 2, p.x, p.y);
        if (d < minD) {
          minD = d;
          closest = p;
        }
      }

      if (closest) {
        a.target = closest;
        moveAnimalMagnetic(a, a.target);
      } else {
        a.state = "free";
        a.target = null;
      }
    }

    // Avoid overlap always
    avoidOverlapping(a);

    // Bounds
    a.x = constrain(a.x, 0, width - a.w);
    a.y = constrain(a.y, 0, height - a.h);

    a.display();
  }
  
  for (let p of detectedPeople) {
    checkProximity(p);
  }

  drawMessages();
  drawPeopleCounter(detectedPeople.length);
  drawCountdownTimer();
  drawCropMarks();
}

function gotResults(result) {
  segmentation = result;
}

function gotPoses(results) {
  poses = results || [];
}

function resetExperience() {
  for (let a of animals) {
    a.x = random(width);
    a.y = random(height);
    a.state = "free";
    a.target = null;
  }

  messageText = "";
  messageTimer = 0;
  remainingPopulation = 100;

  tempBuffer.clear();
  bgBuffer.clear();

  startTime = millis();
}

// Draw smooth silhouette using p5 mask
function drawPrettySilhouetteSmooth() {
  if (!segmentation || !segmentation.maskImageData) return;

  // 1. Create the current frame's mask
  let maskImg = createImage(video.width, video.height);
  maskImg.loadPixels();
  let maskData = segmentation.maskImageData.data;

  for (let i = 0; i < maskData.length; i += 4) {
    maskImg.pixels[i] = 255;
    maskImg.pixels[i + 1] = 255;
    maskImg.pixels[i + 2] = 255;
    maskImg.pixels[i + 3] = maskData[i + 3];
  }
  maskImg.updatePixels();

  // 2. Fade the existing buffer
  tempBuffer.push();
  tempBuffer.background(0, 0, 0, 0);
  let prevFrame = tempBuffer.get();
  tempBuffer.clear();
  tempBuffer.tint(255, 235);
  tempBuffer.image(prevFrame, 0, 0);
  tempBuffer.noTint();

  // 3. Add the new person to the buffer
  tempBuffer.translate(width, 0);
  tempBuffer.scale(-1, 1);
  tempBuffer.image(maskImg, 0, 0, width, height);
  tempBuffer.pop();

  // 4. Create the final cutout
  let sil = prettyScaled.get();
  sil.mask(tempBuffer);

  // 5. Draw it over the BW camera
  image(sil, 0, 0);
}

// Magnetic movement logic
function moveAnimalMagnetic(animal, target) {
  let birdCenterX = animal.x + animal.w / 2;
  let birdCenterY = animal.y + animal.h / 2;
  let d = dist(birdCenterX, birdCenterY, target.x, target.y);

  let strength = map(d, 0, 1500, 0.05, 0.12);
  strength = constrain(strength, 0.05, 0.12);

  animal.x = lerp(animal.x, target.x - animal.w / 2, strength);
  animal.y = lerp(animal.y, target.y - animal.h / 2, strength);
}

// Avoid overlapping between animals
function avoidOverlapping(currentAnimal) {
  for (let other of animals) {
    if (currentAnimal === other) continue;

    let d = dist(
      currentAnimal.x + currentAnimal.w / 2,
      currentAnimal.y + currentAnimal.h / 2,
      other.x + other.w / 2,
      other.y + other.h / 2
    );
    
    let minDistance = (currentAnimal.w + other.w) / 2 + 15;

    if (d < minDistance) {
      let dx = currentAnimal.x - other.x;
      let dy = currentAnimal.y - other.y;
      let angle = atan2(dy, dx);
      
      let targetX = other.x + cos(angle) * minDistance;
      let targetY = other.y + sin(angle) * minDistance;

      currentAnimal.x = lerp(currentAnimal.x, targetX, 0.1);
      currentAnimal.y = lerp(currentAnimal.y, targetY, 0.1);
    }
  }
}

function checkProximity(person) {
  for (let a of animals) {
    let d = dist(
      a.x + a.w / 2,
      a.y + a.h / 2,
      person.x,
      person.y
    );

    if (d < 350) {
      messageText = `${remainingPopulation} Cape Sable seaside sparrows are saved`;
      messageTimer = 180;
    }
  }
}

function drawMessages() {
  if (messageTimer > 0) {
    push();
    let tx = width / 2;
    let ty = 150;

    rectMode(CENTER);
    fill(0, 180);
    noStroke();
    rect(tx, ty, 1100, 80, 15);
    
    textAlign(CENTER, CENTER);
    textSize(40);
    fill(255);
    noStroke();
    text(messageText, tx, ty);
    pop();

    messageTimer--;
  }
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

function checkCollision(animal) {
  if (!segmentation || !segmentation.maskImageData) return false;

  let data = segmentation.maskImageData.data;
  let stepSize = 10;

  for (let x = animal.x; x < animal.x + animal.w; x += stepSize) {
    for (let y = animal.y; y < animal.y + animal.h; y += stepSize) {
      let vx = map(x, width, 0, 0, video.width);
      let vy = map(y, 0, height, 0, video.height);

      vx = floor(vx);
      vy = floor(vy);

      let index = (vy * video.width + vx) * 4;
      let alpha = data[index + 3];

      if (alpha > 128) {
        return true;
      }
    }
  }

  return false;
}

function drawPeopleCounter(count) {
  push();
  fill(0);
  noStroke();
  textSize(50);
  textAlign(LEFT, TOP);
  text(`PEOPLE DETECTED: ${count}`, 80, 80);
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

  // Top Left
  line(pad, pad, pad + len, pad);
  line(pad, pad, pad, pad + len);

  // Top Right
  line(width - pad, pad, width - pad - len, pad);
  line(width - pad, pad, width - pad, pad + len);

  // Bottom Left
  line(pad, height - pad, pad + len, height - pad);
  line(pad, height - pad, pad, height - pad - len);

  // Bottom Right
  line(width - pad, height - pad, width - pad - len, height - pad);
  line(width - pad, height - pad, width - pad, height - pad - len);
  pop();
}

// =========================
// NEW: DIGITAL SKELETON
// =========================

function drawDigitalSkeletons() {
  if (!poses || poses.length === 0) return;

  for (let poseObj of poses) {
    let keypoints = poseObj.keypoints || [];
    if (!keypoints || keypoints.length === 0) continue;

    // skeleton lines
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

    // torso helper
    drawPoseLine(keypoints, "nose", "left_shoulder", [255, 120, 255]);
    drawPoseLine(keypoints, "nose", "right_shoulder", [255, 120, 255]);

    // numbered joints
    const orderedNames = [
      "nose",          // 0
      "left_eye",      // 1
      "right_eye",     // 2
      "left_ear",      // 3
      "right_ear",     // 4
      "left_shoulder", // 5
      "right_shoulder",// 6
      "left_elbow",    // 7
      "right_elbow",   // 8
      "left_wrist",    // 9
      "right_wrist",   // 10
      "left_hip",      // 11
      "right_hip",     // 12
      "left_knee",     // 13
      "right_knee",    // 14
      "left_ankle",    // 15
      "right_ankle"    // 16
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
  // mirrored camera -> x reversed
  return {
    x: map(kp.x, 0, video.width, width, 0),
    y: map(kp.y, 0, video.height, 0, height)
  };
}