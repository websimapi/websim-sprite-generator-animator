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
            Based on the image and description, provide animation data for a 2D game character.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this sprite character described as: "${prompt}". Provide animation data for idle and walk animations following this format:
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
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        json: true  // Request JSON response
      });

      try {
        this.animationData = JSON.parse(completion.content);
      } catch (parseError) {
        // Fallback animation data in case parsing fails
        this.animationData = {
          "spriteType": "character",
          "animationStyle": "pixel",
          "recommendedAnimations": {
            "idle": {
              "description": "Slight bobbing motion",
              "frameCount": 2,
              "frameRate": 6,
              "transformations": ["bob up", "bob down"]
            },
            "walk": {
              "description": "Side to side movement",
              "frameCount": 4,
              "frameRate": 8,
              "transformations": ["bob up", "normal", "bob down", "normal"]
            }
          },
          "movementSpeed": 150
        };
        console.warn("Failed to parse animation data, using fallback:", parseError);
      }
      
      console.log("Animation data:", this.animationData);
      
      // Create animation preview
      gameScene.createAnimationPreview(this.generatedImageUrl, this.animationData);
      
      // Show the animation preview and use sprite button
      document.getElementById('animation-preview-container').classList.remove('hidden');
      document.getElementById('use-sprite-btn').classList.remove('hidden');
      
    } catch (error) {
      console.error('Error analyzing sprite:', error);
      // Provide fallback animation data if analysis fails
      this.animationData = {
        "spriteType": "character",
        "animationStyle": "pixel",
        "recommendedAnimations": {
          "idle": {
            "description": "Slight bobbing motion",
            "frameCount": 2,
            "frameRate": 6,
            "transformations": ["bob up", "bob down"]
          },
          "walk": {
            "description": "Side to side movement",
            "frameCount": 4,
            "frameRate": 8,
            "transformations": ["bob up", "normal", "bob down", "normal"]
          }
        },
        "movementSpeed": 150
      };
      console.warn("Using fallback animation data due to analysis error");
      // Show use sprite button despite error
      document.getElementById('use-sprite-btn').classList.remove('hidden');
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
    this.previewApp = null;
    this.previewSprite = null;
  }

  initialize(spriteUrl, animationData) {
    if (this.initialized) {
      this.cleanup();
    }

    // Initialize PIXI Application
    const gameContainer = document.getElementById('game-container');
    this.app = new PIXI.Application({
      width: gameContainer.clientWidth,
      height: gameContainer.clientHeight,
      backgroundColor: 0x88ccff,
      resolution: window.devicePixelRatio || 1,
      antialias: true
    });

    document.getElementById('game-canvas').innerHTML = '';
    document.getElementById('game-canvas').appendChild(this.app.view);
    
    // Create a simple ground
    const ground = new PIXI.Graphics();
    ground.beginFill(0x567d46);
    ground.drawRect(0, this.app.renderer.height - 50, this.app.renderer.width, 50);
    ground.endFill();
    this.app.stage.addChild(ground);

    // Load the player sprite
    this.loadSpriteTexture(spriteUrl).then(texture => {
      this.setupPlayer(texture, animationData);
      this.setupKeyboardControls();
      this.startGameLoop();
    });

    this.initialized = true;
  }

  async loadSpriteTexture(url) {
    try {
      return await PIXI.Assets.load(url);
    } catch (error) {
      console.error("Error loading sprite texture:", error);
      // Create a fallback texture (red square)
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0xFF0000);
      graphics.drawRect(0, 0, 64, 64);
      graphics.endFill();
      return this.app.renderer.generateTexture(graphics);
    }
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
    this.player.x = this.app.renderer.width / 2;
    this.player.y = this.app.renderer.height - 50 - this.player.height / 2;
    
    // Add player properties
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.movementSpeed = animationData.movementSpeed || 150;
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
    const frameDuration = 60 / (animation.frameRate || 6);
    
    if (this.player.animationTimer > frameDuration) {
      this.player.animationTimer = 0;
      this.player.animationFrame = (this.player.animationFrame + 1) % (animation.frameCount || 2);
      
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
    } else if (this.player.x > this.app.renderer.width - this.player.width / 2) {
      this.player.x = this.app.renderer.width - this.player.width / 2;
    }
    
    // Update animation
    this.updateAnimation(delta);
  }

  cleanup() {
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
      this.player = null;
      this.initialized = false;
    }
    
    if (this.previewApp) {
      this.previewApp.destroy(true, { children: true });
      this.previewApp = null;
      this.previewSprite = null;
    }
  }

  createAnimationPreview(spriteUrl, animationData) {
    if (this.previewApp) {
      this.previewApp.destroy(true, { children: true });
    }

    const previewContainer = document.getElementById('animation-preview');
    previewContainer.innerHTML = '';
    
    // Create idle and walk preview containers
    const idleContainer = document.createElement('div');
    idleContainer.className = 'preview-box';
    idleContainer.innerHTML = '<h4>Idle Animation</h4><div id="idle-preview"></div>';
    
    const walkContainer = document.createElement('div');
    walkContainer.className = 'preview-box';
    walkContainer.innerHTML = '<h4>Walk Animation</h4><div id="walk-preview"></div>';
    
    previewContainer.appendChild(idleContainer);
    previewContainer.appendChild(walkContainer);
    
    // Create idle animation preview
    this.createPreviewAnimation('idle-preview', spriteUrl, animationData, false);
    
    // Create walk animation preview
    this.createPreviewAnimation('walk-preview', spriteUrl, animationData, true);
  }

  async createPreviewAnimation(containerId, spriteUrl, animationData, isWalking) {
    const container = document.getElementById(containerId);
    const previewApp = new PIXI.Application({
      width: 150,
      height: 150,
      backgroundColor: isWalking ? 0xDDEEFF : 0xEEFFEE,
      resolution: window.devicePixelRatio || 1,
      antialias: true
    });
    
    container.appendChild(previewApp.view);
    
    // Load texture
    const texture = await this.loadSpriteTexture(spriteUrl);
    
    // Create sprite
    const sprite = new PIXI.Sprite(texture);
    
    // Scale the sprite
    const maxDimension = 80;
    const scale = maxDimension / Math.max(sprite.width, sprite.height);
    sprite.scale.set(scale);
    
    // Center the sprite
    sprite.anchor.set(0.5);
    sprite.x = previewApp.renderer.width / 2;
    sprite.y = previewApp.renderer.height / 2 + 10;
    
    // Add animation properties
    sprite.animationData = animationData;
    sprite.animationState = isWalking ? "walk" : "idle";
    sprite.animationFrame = 0;
    sprite.animationTimer = 0;
    sprite.isWalking = isWalking;
    sprite.originalY = sprite.y;
    sprite.originalTexture = texture;
    
    // Add to stage
    previewApp.stage.addChild(sprite);
    
    // Start animation loop
    previewApp.ticker.add((delta) => {
      this.updatePreviewAnimation(sprite, delta);
      
      // Add walking movement for walk animation
      if (isWalking) {
        sprite.x += (1 * delta);
        if (sprite.x > previewApp.renderer.width + sprite.width/2) {
          sprite.x = -sprite.width/2;
        }
      }
    });
  }
  
  updatePreviewAnimation(sprite, delta) {
    if (!sprite || !sprite.animationData) return;
    
    // Determine which animation to use
    let animation = sprite.isWalking 
      ? sprite.animationData.recommendedAnimations.walk 
      : sprite.animationData.recommendedAnimations.idle;
    
    // Update animation timer
    sprite.animationTimer += delta;
    const frameDuration = 60 / (animation.frameRate || 6);
    
    if (sprite.animationTimer > frameDuration) {
      sprite.animationTimer = 0;
      sprite.animationFrame = (sprite.animationFrame + 1) % (animation.frameCount || 2);
      
      // Reset transformations
      sprite.y = sprite.originalY;
      sprite.scale.y = Math.abs(sprite.scale.y);
      
      // Apply transformations for the current animation
      const transformations = animation.transformations;
      if (transformations && transformations.length > 0) {
        const transform = transformations[sprite.animationFrame % transformations.length];
        
        if (transform.includes("bob") || transform.includes("up")) {
          sprite.y -= 3;
        } else if (transform.includes("down")) {
          sprite.y += 2;
        }
        
        if (transform.includes("squash")) {
          sprite.scale.y *= 0.9;
        } else if (transform.includes("stretch")) {
          sprite.scale.y *= 1.1;
        }
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
      ground.width = gameScene.app.renderer.width;
      ground.y = gameScene.app.renderer.height - 50;
    }
    
    // Reposition the player
    if (gameScene.player) {
      gameScene.player.originalY = gameScene.app.renderer.height - 50 - gameScene.player.height / 2;
      gameScene.player.y = gameScene.player.originalY;
    }
  }
});