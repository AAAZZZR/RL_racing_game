import carImage from "../assets/car2.png";
export default class Car {
  constructor({
    x = 300,
    y = 500,
    width = 30,
    height = 50,
    angle = Math.PI/2,
    speed = 0,
    maxSpeed = 3,
    accel = 0.2,
    brake = 0.3,
    friction = 0.05,
    turnSpeed = 0.04,
    imageSrc = "", // 圖片路徑，默認為空
  } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.angle = angle;
    this.speed = speed;
    this.maxSpeed = maxSpeed;
    this.accel = accel;
    this.brake = brake;
    this.friction = friction;
    this.turnSpeed = turnSpeed;

    // 加載圖片
    this.image = new Image();
    if (imageSrc) {
      this.image.src = imageSrc;
    }
  }

  // 繪製車子
  draw(ctx) {
    ctx.save();

    // 平移和旋轉到車子的中心點
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate(this.angle);

    if (this.image.complete && this.image.naturalWidth > 0) {
      // 如果圖片加載完成，繪製圖片
      ctx.drawImage(
        this.image,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    } else {
      // 如果圖片未加載完成，使用占位符繪製
      // 1. 車身
      ctx.fillStyle = "#f97316"; // 車身顏色 (橙色)
      ctx.beginPath();
      ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 10); // 帶圓角的長方形
      ctx.fill();

      // 2. 車窗
      ctx.fillStyle = "#ffffff"; // 車窗顏色 (白色)
      ctx.beginPath();
      ctx.roundRect(-this.width / 4, -this.height / 4, this.width / 2, this.height / 6, 5); // 中間車窗
      ctx.fill();

      // 3. 車頭標示 (加強前後區分)
      ctx.fillStyle = "#ef4444"; // 車頭標示顏色 (紅色)
      ctx.beginPath();
      ctx.moveTo(0, -this.height / 2); // 車頭尖端
      ctx.lineTo(-this.width / 4, -this.height / 2 + 15); // 左側
      ctx.lineTo(this.width / 4, -this.height / 2 + 15); // 右側
      ctx.closePath();
      ctx.fill();

      // 4. 車輪
      ctx.fillStyle = "#333"; // 車輪顏色 (黑色)

      // 前輪 (左、右)
      ctx.beginPath();
      ctx.arc(-this.width / 3, -this.height / 2 + 10, 8, 0, Math.PI * 2); // 左前輪
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.width / 3, -this.height / 2 + 10, 8, 0, Math.PI * 2); // 右前輪
      ctx.fill();

      // 後輪 (左、右)
      ctx.beginPath();
      ctx.arc(-this.width / 3, this.height / 2 - 10, 8, 0, Math.PI * 2); // 左後輪
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.width / 3, this.height / 2 - 10, 8, 0, Math.PI * 2); // 右後輪
      ctx.fill();

      // 5. 車子邊框
      ctx.strokeStyle = "#000"; // 黑色邊框
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
    }

    ctx.restore();
  }
}
