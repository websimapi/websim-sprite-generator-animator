import * as PIXI from 'pixi.js';

class SpriteGenerator {
  constructor() {
    this.generatedImageUrl = null;
    this.animationData = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    const generateBtn = document.getElementById('generate-btn');
    const useSpriteBtn = document.getElementById('use-sprite-btn');
    const newSpriteBtn = document.getElementById('new-sprite-btn');

    generateBtn.addEventListener('click', () => this.generateSprite());
    useSpriteBtn.addEventListener('click', () => this.useSprite());
    newSpriteBtn.addEventListener('click', () => this.resetToGenerator());
  }

  async generateSprite() {
    const prompt = document.getElementById('sprite-prompt').value.trim();
    if (!prompt) {
      alert('Please enter a description for your sprite');
      return;
    }

    try {
      // Show loading state
      document.getElementById('generate-btn').disabled = true;
      document.getElementById('generate-btn').textContent = 'Generating...';
      
      // Generate the image
      const fullPrompt = `A pixel art character sprite for a 2D game. The character is ${prompt}. Make it clear and distinct against a transparent background. The character should be facing forward or to the side in a neutral pose.`;
      
      const result = await websim.imageGen({
        prompt: fullPrompt,
        aspect_ratio: "1:1",
      });

      // Display the generated image
      this.generatedImageUrl = result.url;
      const imageContainer = document.getElementById('sprite-image-container');
      imageContainer.innerHTML = `<img src="${this.generatedImageUrl}" alt="Generated sprite">`;
      
      document.getElementById('sprite-result').classList.remove('hidden');
      document.getElementById('loading-message').classList.remove('hidden');
      
      // Analyze the sprite for animation
      await this.analyzeSpriteForAnimation(this.generatedImageUrl, prompt);
      
    } catch (error) {
      console.error('Error generating sprite:', error);
      alert('Error generating sprite. Please try again.');
    } finally {
      document.getElementById('generate-btn').disabled = false;
      document.getElementById('generate-btn').textContent = 'Generate Sprite';
      document.getElementById('loading-message').classList.add('hidden');
    }
  }

  async analyzeSpriteForAnimation(imageUrl, prompt) {
    try {
      const completion = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an AI that analyzes game sprites and determines appropriate animations. 
            Based on the image and description, you will provide animation data for a 2D game character.
            Respond directly with JSON, following this JSON schema, and no other text.
            {
              "spriteType": "character type (e.g. human, monster, animal)",
              "animationStyle": "pixel", 
              "recommendedAnimations": {
                "idle": {
                  "description": "description of idle animation",
                  "frameCount": number between 2-4,
                  "frameRate": number between 4-10,
                  "transformations": ["slight movements to apply to sprite for animation"]
                },
                "walk": {
                  "description": "description of walking animation",
                  "frameCount": number between 2-6,
                  "frameRate": number between 5-12,
                  "transformations": ["slight movements to apply to sprite for animation"]
                }
              },
              "movementSpeed": number between 100-200
            }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this sprite character described as: "${prompt}". Provide animation data for idle and walk animations.`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        json: true
      });

      this.animationData = JSON.parse(completion.content);
      console.log("Animation data:", this.animationData);
      
      // Show the use sprite button
      document.getElementById('use-sprite-btn').classList.remove('hidden');
      
    } catch (error) {
      console.error('Error analyzing sprite:', error);
      alert('Error analyzing sprite for animation. Please try again.');
    }
  }

  useSprite() {
    if (!this.generatedImageUrl || !this.animationData) {
      alert('Please generate a sprite first');
      return;
    }

    // Hide generation panel and show game panel
    document.querySelector('.generation-panel').classList.add('minimized');
    document.getElementById('game-panel').classList.remove('hidden');
    
    // Initialize game
    gameScene.initialize(this.generatedImageUrl, this.animationData);
  }

  resetToGenerator() {
    document.querySelector('.generation-panel').classList.remove('minimized');
    document.getElementById('game-panel').classList.add('hidden');
    document.getElementById('sprite-result').classList.add('hidden');
    document.getElementById('use-sprite-btn').classList.add('hidden');
    document.getElementById('sprite-prompt').value = '';
    
    // Clean up game resources
    gameScene.cleanup();
  }
}

class GameScene {
  constructor() {
    this.app = null;
    this.player = null;
    this.keyboard = {};
    this.initialized = false;
  }

  initialize(spriteUrl, animationData) {
    if (this.initialized) {
      this.cleanup();
    }

    // Initialize PIXI Application
    this.app = new PIXI.Application({
      width: document.getElementById('game-container').clientWidth,
      height: document.getElementById('game-container').clientHeight,
      backgroundColor: 0x88ccff,
      resolution: window.devicePixelRatio || 1,
    });

    document.getElementById('game-canvas').appendChild(this.app.view);
    
    // Create a simple ground
    const ground = new PIXI.Graphics();
    ground.beginFill(0x567d46);
    ground.drawRect(0, this.app.screen.height - 50, this.app.screen.width, 50);
    ground.endFill();
    this.app.stage.addChild(ground);

    // Load the player sprite
    PIXI.Assets.load(spriteUrl).then(texture => {
      this.setupPlayer(texture, animationData);
      this.setupKeyboardControls();
      this.startGameLoop();
    });

    this.initialized = true;
  }

  setupPlayer(texture, animationData) {
    // Create player sprite
    this.player = new PIXI.Sprite(texture);
    
    // Scale the sprite appropriately
    const maxDimension = 100;
    const scale = maxDimension / Math.max(this.player.width, this.player.height);
    this.player.scale.set(scale);
    
    // Center the sprite's anchor point
    this.player.anchor.set(0.5);
    
    // Position the player
    this.player.x = this.app.screen.width / 2;
    this.player.y = this.app.screen.height - 50 - this.player.height / 2;
    
    // Add player properties
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.movementSpeed = animationData.movementSpeed;
    this.player.isWalking = false;
    this.player.direction = 1; // 1 for right, -1 for left
    
    // Setup animations
    this.setupAnimations(animationData);
    
    // Add to stage
    this.app.stage.addChild(this.player);
  }

  setupAnimations(animationData) {
    this.player.animationData = animationData;
    this.player.animationState = "idle";
    this.player.animationFrame = 0;
    this.player.animationTimer = 0;
    this.player.originalY = this.player.y;
    
    // Store original texture for transformations
    this.player.originalTexture = this.player.texture;
  }

  updateAnimation(delta) {
    if (!this.player || !this.player.animationData) return;
    
    // Determine which animation to use
    let animation;
    if (this.player.isWalking) {
      animation = this.player.animationData.recommendedAnimations.walk;
      this.player.animationState = "walk";
    } else {
      animation = this.player.animationData.recommendedAnimations.idle;
      this.player.animationState = "idle";
    }
    
    // Update animation timer
    this.player.animationTimer += delta;
    const frameDuration = 60 / animation.frameRate;
    
    if (this.player.animationTimer > frameDuration) {
      this.player.animationTimer = 0;
      this.player.animationFrame = (this.player.animationFrame + 1) % animation.frameCount;
      
      // Apply transformations based on current frame
      this.applyAnimationFrame(animation, this.player.animationFrame);
    }
  }

  applyAnimationFrame(animation, frameIndex) {
    // Reset transformations
    this.player.y = this.player.originalY;
    this.player.scale.y = Math.abs(this.player.scale.y);
    
    // Apply transformations for the current animation
    const transformations = animation.transformations;
    if (transformations && transformations.length > 0) {
      const transform = transformations[frameIndex % transformations.length];
      
      if (transform.includes("bob") || transform.includes("up")) {
        this.player.y -= 3;
      } else if (transform.includes("down")) {
        this.player.y += 2;
      }
      
      if (transform.includes("squash")) {
        this.player.scale.y *= 0.9;
      } else if (transform.includes("stretch")) {
        this.player.scale.y *= 1.1;
      }
    }
  }

  setupKeyboardControls() {
    // Keyboard event listeners
    window.addEventListener('keydown', (e) => {
      this.keyboard[e.key] = true;
    });
    
    window.addEventListener('keyup', (e) => {
      this.keyboard[e.key] = false;
    });
  }

  startGameLoop() {
    this.app.ticker.add((delta) => {
      this.update(delta);
    });
  }

  update(delta) {
    if (!this.player) return;
    
    // Reset movement flag
    this.player.isWalking = false;
    
    // Handle controls
    if (this.keyboard['ArrowLeft'] || this.keyboard['a'] || this.keyboard['A']) {
      this.player.vx = -this.player.movementSpeed;
      this.player.isWalking = true;
      this.player.direction = -1;
      this.player.scale.x = -Math.abs(this.player.scale.x); // Flip sprite
    } 
    else if (this.keyboard['ArrowRight'] || this.keyboard['d'] || this.keyboard['D']) {
      this.player.vx = this.player.movementSpeed;
      this.player.isWalking = true;
      this.player.direction = 1;
      this.player.scale.x = Math.abs(this.player.scale.x); // Normal sprite
    } 
    else {
      this.player.vx = 0;
    }
    
    // Update player position
    this.player.x += this.player.vx * delta * 0.1;
    
    // Keep player within screen bounds
    if (this.player.x < this.player.width / 2) {
      this.player.x = this.player.width / 2;
    } else if (this.player.x > this.app.screen.width - this.player.width / 2) {
      this.player.x = this.app.screen.width - this.player.width / 2;
    }
    
    // Update animation
    this.updateAnimation(delta);
  }

  cleanup() {
    if (this.app) {
      this.app.destroy(true, true);
      this.app = null;
      this.player = null;
      this.initialized = false;
      
      // Remove canvas
      const canvas = document.getElementById('game-canvas');
      while (canvas.firstChild) {
        canvas.removeChild(canvas.firstChild);
      }
    }
  }
}

// Initialize classes
const spriteGenerator = new SpriteGenerator();
const gameScene = new GameScene();

// Handle window resize
window.addEventListener('resize', () => {
  if (gameScene.app) {
    gameScene.app.renderer.resize(
      document.getElementById('game-container').clientWidth,
      document.getElementById('game-container').clientHeight
    );
    
    // Reposition the ground
    if (gameScene.app.stage.children.length > 0) {
      const ground = gameScene.app.stage.children[0];
      ground.width = gameScene.app.screen.width;
      ground.y = gameScene.app.screen.height - 50;
    }
    
    // Reposition the player
    if (gameScene.player) {
      gameScene.player.originalY = gameScene.app.screen.height - 50 - gameScene.player.height / 2;
      gameScene.player.y = gameScene.player.originalY;
    }
  }
});

