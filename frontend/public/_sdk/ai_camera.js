// public/_sdk/ai_camera.js

class AICamera {
    constructor(videoElementId, callback) {
        this.video = document.getElementById(videoElementId);
        this.callback = callback;
        this.isModelLoaded = false;
        this.isRunning = false;
        this.interval = null;
        this.negativeStartAt = null;
        this.lastDominant = null;
        this.MIN_CONFIDENCE = 0.5;
        this.REQUIRED_DURATION = 2000;
        this.COOLDOWN = false;
        this.COOLDOWN_MS = 10000;
        this.DETECT_INTERVAL_MS = 400;
        this._boundPlay = null;
    }

    async loadModels() {
        // Đường dẫn này cực quan trọng, nó trỏ vào public/models
        const MODEL_URL = '/models'; 
        console.log("📷 [AI] Bắt đầu tải Model từ:", MODEL_URL);

        try {
            // Kiểm tra xem faceapi có tồn tại không
            if (typeof faceapi === 'undefined') {
                throw new Error("Chưa load thư viện face-api.min.js! Hãy kiểm tra thẻ <script>");
            }

            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
            console.log("✅ [AI] Tải Model thành công!");
            this.isModelLoaded = true;
        } catch (e) {
            console.error("❌ [AI] Lỗi tải Model:", e);
            alert("Lỗi tải AI: " + e.message + "\n\n(Hãy F12 xem tab Network có bị 404 không)");
            throw e; // Ném lỗi để dừng hàm start()
        }
    }

    async start() {
        console.log("🚀 [AI] Đang khởi động Camera...");
        
        // 1. Tải model trước
        if (!this.isModelLoaded) {
            try {
                await this.loadModels();
            } catch (e) {
                return; // Dừng nếu lỗi model
            }
        }
        
        // 2. Xin quyền Camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            console.log("✅ [AI] Đã cấp quyền Camera!");
            
            this.video.srcObject = stream;
            this.isRunning = true;

            if (!this._boundPlay) {
                this._boundPlay = () => {
                    console.log("▶️ [AI] Video đang phát, bắt đầu quét...");
                    
                    // Tạo canvas ảo để tính toán kích thước
                    const canvas = faceapi.createCanvasFromMedia(this.video);
                    const displaySize = { width: this.video.width || 320, height: this.video.height || 240 };
                    faceapi.matchDimensions(canvas, displaySize);

                    if (this.interval) clearInterval(this.interval);
                    this.interval = setInterval(async () => {
                        if (this.COOLDOWN) return; 

                        try {
                            const detections = await faceapi.detectAllFaces(
                                this.video,
                                new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
                            )
                                .withFaceExpressions();

                            if (detections.length > 0) {
                                const expressions = detections[0].expressions;
                                this.analyzeEmotion(expressions);
                            }
                        } catch (err) {
                            console.error("Lỗi quét mặt:", err);
                        }
                    }, this.DETECT_INTERVAL_MS); 
                };
                this.video.addEventListener('play', this._boundPlay);
            }
        } catch (err) {
            console.error("❌ [AI] Lỗi xin quyền Camera:", err);
            alert("Không thể mở Camera: " + err.message + "\nHãy kiểm tra biểu tượng ổ khóa trên thanh địa chỉ.");
        }
    }

    stop() {
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        clearInterval(this.interval);
        this.isRunning = false;
        this.resetStruggle();
        console.log("🛑 [AI] Đã tắt Camera.");
    }

    resetStruggle() {
        this.negativeStartAt = null;
        this.lastDominant = null;
    }

    analyzeEmotion(expressions) {
        const emotions = Object.keys(expressions);
        let maxScore = 0;
        let dominant = 'neutral';

        emotions.forEach(e => {
            if (expressions[e] > maxScore) {
                maxScore = expressions[e];
                dominant = e;
            }
        });

        const negativeEmotions = ['sad', 'angry', 'fearful'];
        const isNegative = negativeEmotions.includes(dominant) && maxScore >= this.MIN_CONFIDENCE;

        if (isNegative) {
            const now = Date.now();
            if (!this.negativeStartAt || this.lastDominant !== dominant) {
                this.negativeStartAt = now;
                this.lastDominant = dominant;
            }
            if (now - this.negativeStartAt >= this.REQUIRED_DURATION) {
                this.callback('struggling', dominant, maxScore);
                this.resetStruggle();
                this.triggerCooldown();
            }
        } else {
            this.resetStruggle();
        }
    }

    triggerCooldown() {
        this.COOLDOWN = true;
        setTimeout(() => { this.COOLDOWN = false; }, this.COOLDOWN_MS);
    }
}