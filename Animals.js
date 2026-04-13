class Animal {
  constructor(img, targetWidth) {
    this.img = img;

    this.w = targetWidth;
    let aspect = img.height / img.width;
    this.h = this.w * aspect;

    this.x = random(width * 0.1, width * 0.9);
    this.y = random(height * 0.1, height * 0.9);

    this.speedX = random(-2, 2);
    this.speedY = random(-2, 2);

    this.fleeThreshold = 900;
    this.fleeSpeed = 35;
    this.maxWanderSpeed = 2;
  }

  display() {
    image(this.img, this.x, this.y, this.w, this.h);
  }

  flee(targetX, targetY) {
    let centerX = this.x + this.w / 2;
    let centerY = this.y + this.h / 2;

    let d = dist(centerX, centerY, targetX, targetY);

    if (d < this.fleeThreshold) {
      let angle = atan2(centerY - targetY, centerX - targetX);
      this.speedX = cos(angle) * this.fleeSpeed;
      this.speedY = sin(angle) * this.fleeSpeed;
    } else {
      this.speedX += random(-0.1, 0.1);
      this.speedY += random(-0.1, 0.1);

      this.speedX *= 0.98;
      this.speedY *= 0.98;

      this.speedX = constrain(this.speedX, -this.maxWanderSpeed, this.maxWanderSpeed);
      this.speedY = constrain(this.speedY, -this.maxWanderSpeed, this.maxWanderSpeed);
    }
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    if (this.x < 0 || this.x > width - this.w) this.speedX *= -1;
    if (this.y < 0 || this.y > height - this.h) this.speedY *= -1;
  }
}