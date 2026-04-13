// to do: 
// 1. done - fix so it  works with multiple people (redo center calculation)
// 2. done -  make the mask stuff slower - like the opacity slowly fades in / out as the person is detected instead of being so harsh
// 3. add skeleton / outline to person OR add like a counter 'x people detected'
// 4. done - add crop marks in corners
// 5. change bg to something more meaningful - maybe gt land area before gt was built ? 
// 6. done - why is the text always showing now, it should only show when there is a collision ?



// variables for nature bg
let tempBuffer;
let finalImg;


// variables for camera bw bg
let bgBuffer;

let currentFade = 0; // The actual opacity being drawnlet video;
let prettyBg, constructionBg;
let animals = [];
let people =[];
let bodySegmentation;
let segmentation;
let options = { maskType: "background" };
let sparrowImg;

// Population & Message
let remainingPopulation = 100;
let messageText = "";
let messageTimer = 0;

let prettyScaled;

function preload() {
  // Check path: assets -> animals -> sparrow.png
  sparrowImg = loadImage("assets/animals/sparrow.png"); 
  prettyBg = loadImage('assets/grass.jpg');
  constructionBg = loadImage('assets/construction.png');
  bodySegmentation = ml5.bodySegmentation("SelfieSegmentation", options);
}

function setup() {
  createCanvas(3072, 1280);
  
  tempBuffer = createGraphics(width, height);
  finalImg = createImage(width, height);
  
  bgBuffer = createGraphics(width, height);
  
  // Pre-draw the nature texture to the canvas size
  prettyScaled = createGraphics(width, height);
  prettyScaled.image(prettyBg, 0, 0, width, height);

  // Create animals and place them randomly at the start
  for (let i = 0; i < 15; i++) {
    let a = new Animal(sparrowImg, random(1.2, 2.0));

    a.w = random(100, 150);
    a.h = a.w;

    a.x = random(width);
    a.y = random(height);

    // NEW STATE SYSTEM
    a.state = "free";
    a.target = null;

    animals.push(a);
  }

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  bodySegmentation.detectStart(video, gotResults);

  textAlign(CENTER, CENTER);
  textFont('Courier New');
}

function draw() {
  // draw camera bg in bw filter
  if (video.loadedmetadata) {
    bgBuffer.push();
    bgBuffer.translate(width, 0);
    bgBuffer.scale(-1, 1);
    bgBuffer.image(video, 0, 0, width, height);
    bgBuffer.pop();
    bgBuffer.filter(GRAY);
    image(bgBuffer, 0, 0);
  }

  // 2. Draw smooth silhouette with nature texture
  drawPrettySilhouetteSmooth();

  let people = getPeople();
  
  // draws a red dot  at every person center
  for (let p of people) {
    fill(255, 0, 0);
    ellipse(p.x, p.y, 20, 20);
  }

  for (let a of animals) {
    if (a.update) {
        a.update();
     }
    // 1. free movement
    if (a.state === "free") {
      // check collision with ANY person
      if (checkCollision(a)) {
        messageText = `${remainingPopulation} Cape Sable seaside sparrows are saved`;
        messageTimer = 120; // Show for ~2 seconds
        // find closest person
        let closest = null;
        let minD = Infinity;
  
        for (let p of people) {
          let d = dist(
            a.x + a.w/2,
            a.y + a.h/2,
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

    // 2. captured movement
    if (a.state === "captured") {
      // Find the nearest person center EVERY frame so the target updates
      let closest = null;
      let minD = Infinity;
      for (let p of people) {
        let d = dist(a.x + a.w/2, a.y + a.h/2, p.x, p.y);
        if (d < minD) {
          minD = d;
          closest = p;
        }
      }

      if (closest) {
        a.target = closest; // Update the target to the current position
        moveAnimalMagnetic(a, a.target);
      } else {
        // If no people are detected anymore,  set back to free
        a.state = "free";
      }
    }

    // 3. avoid overlap always
    avoidOverlapping(a);

    // 4. bounds
    a.x = constrain(a.x, 0, width - a.w);
    a.y = constrain(a.y, 0, height - a.h);

    a.display();
  }
  
  for (let p of people) {
    checkProximity(p);
  }
  drawMessages();
  drawPeopleCounter(people.length);
  drawCropMarks();
}

function gotResults(result) {
  segmentation = result;
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
    maskImg.pixels[i+1] = 255;
    maskImg.pixels[i+2] = 255;
    maskImg.pixels[i+3] = maskData[i+3]; 
  }
  maskImg.updatePixels();

  // 2. THE FIX: Only "fade" the pixels already in the buffer
  // We use 'tint' to lower the opacity of the existing buffer 
  // before drawing the new person on top.
  tempBuffer.push();
  tempBuffer.background(0, 0, 0, 0); // Keep buffer transparent
  let prevFrame = tempBuffer.get(); 
  tempBuffer.clear();
  tempBuffer.tint(255, 235); // 230/255 = how much survives each frame (linger)
  tempBuffer.image(prevFrame, 0, 0);
  tempBuffer.noTint();

  // 3. Add the new person to the buffer
  tempBuffer.translate(width, 0);
  tempBuffer.scale(-1, 1);
  tempBuffer.image(maskImg, 0, 0, width, height);
  tempBuffer.pop();

  // 4. Create the final "cutout"
  // We MUST create a fresh image so the mask doesn't accumulate 
  // on the texture itself.
  let sil = prettyScaled.get(); 
  sil.mask(tempBuffer);

  // 5. Draw it over your BW camera (which is already drawn in draw())
  image(sil, 0, 0);
}

// Magnetic movement logic
function moveAnimalMagnetic(animal, target) {
  let birdCenterX = animal.x + animal.w / 2;
  let birdCenterY = animal.y + animal.h / 2;
  let d = dist(birdCenterX, birdCenterY, target.x, target.y);

  // Pull stronger when far, smoother when close (strength: 0.05 ~ 0.12)
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
      currentAnimal.x + currentAnimal.w/2, currentAnimal.y + currentAnimal.h/2, 
      other.x + other.w/2, other.y + other.h/2
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
    let ty = 150; // Adjusted height so it's not right in the middle

    rectMode(CENTER);
    fill(0, 180); // Darker background for readability
    noStroke();
    rect(tx, ty, 1100, 80, 15);
    
    textAlign(CENTER, CENTER);
    textSize(40);
    fill(255);
    noStroke(); // Cleaner look without the heavy stroke
    text(messageText, tx, ty);
    pop();

    messageTimer--; // Countdown the timer
  }
}

function getPeople() {
  if (!segmentation || !segmentation.maskImageData) return [];

  let data = segmentation.maskImageData.data;
  let points = [];
  let step = 20; // Increased step = less noise

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
  let threshold = 250; // Even higher to bridge gaps between limbs/torso

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

  // Sort by size (count) and take only the biggest ones
  // Then filter out anything that doesn't have a significant mass
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

  // sample a grid inside the animal (not every pixel = faster)
  let stepSize = 10;

  for (let x = animal.x; x < animal.x + animal.w; x += stepSize) {
    for (let y = animal.y; y < animal.y + animal.h; y += stepSize) {

      // map canvas → video space (reverse of your silhouette mapping)
      let vx = map(x, width, 0, 0, video.width); // mirrored
      let vy = map(y, 0, height, 0, video.height);

      vx = floor(vx);
      vy = floor(vy);

      let index = (vy * video.width + vx) * 4;

      let alpha = data[index + 3];

      if (alpha > 128) {
        return true; // this animal touched the person
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
  // Draws in the top-left, slightly offset from the crop marks
  text(`PEOPLE DETECTED: ${count}`, 80, 80);
  pop();
}

function drawCropMarks() {
  push();
  stroke(255, 0, 0); // Red so they are easy to see for testing
  strokeWeight(15);
  let len = 40;   // Length of the lines
  let pad = 20;   // Distance from the very edge of the canvas

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