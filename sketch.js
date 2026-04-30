// =========================
// FINAL VERSION (FULL)
// =========================

const INFO_TOTAL_DURATION = 18000;
const SENTENCE_DURATION = 5500;
const RESET_TIME = 60000;

let video, segmentation, bodySegmentation;
let ghostImg, prettyBg, oceanBg;
let spirits = [];
let activeInfo = [null, null];
let speciesData = [];

let startTime;
const GHOST_COUNT = 30;
const GHOST_SIZE = 60;
const ANIMAL_SIZE = 200;

// =========================
// PRELOAD
// =========================
function preload() {
  ghostImg = loadImage("assets/animals/ghost.png");
  prettyBg = loadImage("assets/grass.jpg");
  oceanBg = loadImage("assets/animals/ocean.jpg");

  speciesData = [
    {
      name: "Wood Stork",
      img: loadImage("assets/animals/WoodStork.png"),
      habitat: "land",
      bubbleColor: [200,200,200],
      info: [
        "\"Hi! I'm the Wood Stork.\"",
        "I live in swamps in Georgia.",
        "Wetlands destruction threatens me."
      ]
    }
  ];

  bodySegmentation = ml5.bodySegmentation("SelfieSegmentation");
}

// =========================
// SETUP
// =========================
function setup() {
  createCanvas(1920,1080);

  video = createCapture(VIDEO);
  video.size(640,480);
  video.hide();

  bodySegmentation.detectStart(video, res => segmentation = res);

  for(let i=0;i<GHOST_COUNT;i++){
    spirits.push(new Spirit(random(speciesData)));
  }

  startTime = millis();
}

// =========================
// DRAW
// =========================
function draw(){
  background(0);

  drawCamera();

  for(let s of spirits){
    s.update();

    if(s.state==="ghost" && !activeInfo[0]){
      if(random()<0.002){
        startInteraction(s);
      }
    }

    if(s.state==="attached"){
      followCenter(s);
    }

    s.display();
  }

  updateInfo();
  showInfoPanel();
}

// =========================
// CAMERA
// =========================
function drawCamera(){
  if(!video.loadedmetadata) return;

  push();
  translate(width,0);
  scale(-1,1);
  image(video,0,0,width,height);
  pop();
}

// =========================
// INTERACTION
// =========================
function startInteraction(s){
  s.state="attached";

  activeInfo[0]={
    spirit:s,
    start:millis(),
    sentences:s.species.info,
    color:s.species.bubbleColor
  };
}

// =========================
// UPDATE INFO
// =========================
function updateInfo(){
  if(!activeInfo[0]) return;

  if(millis()-activeInfo[0].start > INFO_TOTAL_DURATION){
    turnBackToGhost(activeInfo[0].spirit);
    activeInfo[0]=null;
  }
}

// =========================
// FOLLOW PERSON CENTER
// =========================
function followCenter(s){
  let cx = width/2;
  let cy = height/2;

  s.x = lerp(s.x, cx-ANIMAL_SIZE/2, 0.1);
  s.y = lerp(s.y, cy-ANIMAL_SIZE/2, 0.1);
}

// =========================
// RETURN TO GHOST
// =========================
function turnBackToGhost(s){
  s.state="ghost";
  s.img=ghostImg;

  let angle=random(TWO_PI);
  let speed=4;

  s.vx = cos(angle)*speed;
  s.vy = sin(angle)*speed;
}

// =========================
// PANEL (🔥 핵심)
// =========================
function showInfoPanel(){
  let info = activeInfo[0];
  if(!info) return;

  let species = info.spirit.species;

  let x=80,y=100,w=600,h=800;

  let t = millis()-info.start;
  let i = floor(t/SENTENCE_DURATION);
  i = constrain(i,0,species.info.length-1);

  let currentSentence = species.info[i];

  push();

  fill(0,180);
  stroke(species.bubbleColor);
  strokeWeight(4);
  rect(x,y,w,h,20);

  // 이름
  fill(species.bubbleColor);
  noStroke();
  textSize(40);
  textAlign(LEFT,TOP);
  text(species.name, x+20, y+20);

  // 🔥 동물 이미지
  imageMode(CENTER);
  image(species.img, x+w/2, y+200, 250,250);

  // info
  fill(255);
  textSize(24);
  text("REGION: Georgia, USA", x+20, y+360);
  text("HABITAT: "+species.habitat.toUpperCase(), x+20, y+400);

  // 메시지
  textSize(28);
  text("ANIMAL MESSAGE", x+20, y+460);

  textSize(26);
  text(currentSentence, x+20, y+520, w-40);

  pop();
}

// =========================
// SPIRIT
// =========================
class Spirit{
  constructor(species){
    this.species=species;
    this.state="ghost";
    this.x=random(width);
    this.y=random(height);
    this.vx=random(-2,2);
    this.vy=random(-2,2);
  }

  update(){
    if(this.state==="ghost"){
      this.x+=this.vx;
      this.y+=this.vy;
    }
  }

  display(){
    if(this.state==="ghost"){
      image(ghostImg,this.x,this.y,60,60);
    }else{
      image(this.species.img,this.x,this.y,ANIMAL_SIZE,ANIMAL_SIZE);
    }
  }
}