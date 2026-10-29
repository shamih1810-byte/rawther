import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * AnimatedBackground
 * Dynamic Full-Web Animatic Food Theme Background.
 * 
 * Features:
 * 1. Full-screen living food background imagery that smoothly cross-fades
 *    as the user scrolls down through different menu categories:
 *    - Biriyani (Heritage Dum Biriyani)
 *    - Rice (Aromatic Fried Rice)
 *    - Noodles (Wok-Tossed Noodles)
 *    - Breads (Tandoor Fresh Naan & Rotis)
 *    - Starters (Crispy Chicken 65 & Starters)
 *    - Thanthoori (Smoky Charcoal Tandoori Grills)
 *    - Butter Items (Skillet Butter Chicken)
 *    - Gravies (Rich Copper Handi Masalas)
 *    - Paneer (Velvety Malai Paneer)
 * 2. Continuous "Animatic" camera motion (Ken Burns slow breathing pan/zoom).
 * 3. Deep luxury gradient vignette ensuring 100% text legibility and card contrast.
 * 4. 60 FPS HTML5 Canvas with floating star anise, cardamom, cloves, mint leaves, and glowing embers.
 * 5. Floating ambient food scene indicator on the bottom-left with smooth auto-hide.
 */

const FOOD_SCENES = [
  {
    key: 'biriyani',
    title: 'Heritage Dum Biriyani',
    image: '/images/dishes/biriyani.jpg',
    glowColor: 'rgba(255, 255, 255, 0.25)',
    keywords: ['biriyani']
  },
  {
    key: 'rice',
    title: 'Aromatic Fried Rice',
    image: '/images/dishes/rice.jpg',
    glowColor: 'rgba(234, 179, 8, 0.3)',
    keywords: ['rice']
  },
  {
    key: 'noodles',
    title: 'Sizzling Wok Noodles',
    image: '/images/dishes/noodles.jpg',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    keywords: ['noodles']
  },
  {
    key: 'bread',
    title: 'Clay Oven Fresh Naan',
    image: '/images/dishes/bread.jpg',
    glowColor: 'rgba(251, 146, 60, 0.35)',
    keywords: ['bread', 'naan', 'rotti', 'kulcha']
  },
  {
    key: 'starters',
    title: 'Crisp Charcoal Starters',
    image: '/images/dishes/starter.jpg',
    glowColor: 'rgba(239, 68, 68, 0.35)',
    keywords: ['starter', '65']
  },
  {
    key: 'tandoori',
    title: 'Charcoal Tandoori Grills',
    image: '/images/dishes/tandoori.jpg',
    glowColor: 'rgba(220, 38, 38, 0.4)',
    keywords: ['thanthoori', 'tandoori', 'tikka', 'kabab']
  },
  {
    key: 'butter_chicken',
    title: 'Skillet Butter Chicken',
    image: '/images/dishes/butter-chicken.jpg',
    glowColor: 'rgba(234, 88, 12, 0.35)',
    keywords: ['butter items']
  },
  {
    key: 'curry',
    title: 'Simmering Masala Gravies',
    image: '/images/dishes/curry.jpg',
    glowColor: 'rgba(217, 119, 6, 0.35)',
    keywords: ['chicken gravy', 'beef gravy', 'mushroom gravy', 'veg gravy']
  },
  {
    key: 'paneer',
    title: 'Velvety Malai Paneer',
    image: '/images/dishes/paneer.jpg',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    keywords: ['paneer gravy']
  }
];

export default function AnimatedBackground() {
  const canvasRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  const [activeSceneKey, setActiveSceneKey] = useState('biriyani');
  const [showBadge, setShowBadge] = useState(false);
  const badgeTimerRef = useRef(null);

  // Preload food background images for instant smooth transitions
  useEffect(() => {
    FOOD_SCENES.forEach((scene) => {
      const img = new Image();
      img.src = scene.image;
    });
  }, []);

  // Match category text to scene key
  const getSceneForText = (text) => {
    const lower = text.toLowerCase();
    for (const scene of FOOD_SCENES) {
      for (const kw of scene.keywords) {
        if (lower.includes(kw)) return scene.key;
      }
    }
    return 'biriyani';
  };

  // Listen to custom menu category events from CustomerMenu
  useEffect(() => {
    const handleCategoryChange = (e) => {
      if (e.detail && e.detail.name) {
        const matched = getSceneForText(e.detail.name);
        if (matched) {
          triggerSceneChange(matched);
        }
      }
    };
    window.addEventListener('menu-category-change', handleCategoryChange);
    return () => window.removeEventListener('menu-category-change', handleCategoryChange);
  }, []);

  const triggerSceneChange = (newKey) => {
    setActiveSceneKey((prev) => {
      if (prev !== newKey) {
        // Show brief ambiance pill
        setShowBadge(true);
        if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
        badgeTimerRef.current = setTimeout(() => setShowBadge(false), 2400);
        return newKey;
      }
      return prev;
    });
  };

  // Scroll detection: checks scroll position & categories in viewport
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const sy = window.scrollY || 0;
          setScrollY(sy);

          // If at the top of the menu (Hero Banner / Entrance Slider), default to Biriyani
          if (sy < 240) {
            triggerSceneChange('biriyani');
            ticking = false;
            return;
          }

          // Check visible category sections in the viewport
          const categorySections = document.querySelectorAll('section[id^="category-"]');
          const triggerLine = window.innerHeight * 0.42;

          for (let i = 0; i < categorySections.length; i++) {
            const section = categorySections[i];
            const rect = section.getBoundingClientRect();
            if (rect.top <= triggerLine && rect.bottom > 80) {
              const heading = section.querySelector('h3');
              const text = (heading?.innerText || section.id).toLowerCase();
              const matched = getSceneForText(text);
              triggerSceneChange(matched);
              break;
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // HTML5 Canvas for floating spices, herbs, and aroma embers over food image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouse = { x: width / 2, y: height / 3, targetX: width / 2, targetY: height / 3 };
    let currentScrollY = window.scrollY || 0;
    let smoothScrollY = currentScrollY;
    let lastScrollY = currentScrollY;
    let scrollVelocity = 0;

    const handleScroll = () => {
      const sy = window.scrollY || 0;
      scrollVelocity = (sy - lastScrollY) * 0.28;
      lastScrollY = sy;
      currentScrollY = sy;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const handlePointerMove = (e) => {
      mouse.targetX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : width / 2);
      mouse.targetY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : height / 3);
    };
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const particleCount = Math.min(42, Math.floor((width * height) / 22000));
    const particles = [];
    const spiceTypes = ['star_anise', 'cardamom', 'clove', 'herb_leaf', 'ember', 'ember'];

    const goldPalette = ['rgba(255, 255, 255, ', 'rgba(247, 241, 225, ', 'rgba(255, 255, 255, '];
    const herbPalette = ['rgba(135, 169, 107, ', 'rgba(164, 195, 139, ', 'rgba(107, 140, 82, '];
    const emberPalette = ['rgba(255, 255, 255, ', 'rgba(240, 240, 240, ', 'rgba(255, 255, 255, '];

    for (let i = 0; i < particleCount; i++) {
      const type = spiceTypes[i % spiceTypes.length];
      let colorPrefix;
      let radius;

      if (type === 'herb_leaf') {
        colorPrefix = herbPalette[Math.floor(Math.random() * herbPalette.length)];
        radius = Math.random() * 5 + 6;
      } else if (type === 'ember') {
        colorPrefix = emberPalette[Math.floor(Math.random() * emberPalette.length)];
        radius = Math.random() * 2 + 0.8;
      } else {
        colorPrefix = goldPalette[Math.floor(Math.random() * goldPalette.length)];
        radius = type === 'star_anise' ? Math.random() * 4.5 + 6 : Math.random() * 3.5 + 4.5;
      }

      particles.push({
        type,
        x: Math.random() * width,
        baseY: Math.random() * height * 1.8,
        radius,
        colorPrefix,
        speedY: type === 'ember' ? Math.random() * 0.6 + 0.25 : Math.random() * 0.32 + 0.12,
        speedX: (Math.random() - 0.5) * 0.28,
        parallaxSpeed: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * 0.02 + 0.008,
        swayAmplitude: Math.random() * 0.7 + 0.3,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
        maxOpacity: type === 'ember' ? Math.random() * 0.6 + 0.3 : Math.random() * 0.45 + 0.18,
      });
    }

    const drawStarAnise = (cx, cy, radius, rot, color) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = color;
      ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.12)');
      ctx.lineWidth = 1.1;

      const points = 8;
      const step = (Math.PI * 2) / points;
      for (let i = 0; i < points; i++) {
        const angle = i * step;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(radius * 0.35, radius * 0.5, 0, radius);
        ctx.quadraticCurveTo(-radius * 0.35, radius * 0.5, 0, 0);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, radius * 0.6, radius * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    const drawCardamom = (cx, cy, size, rot, color) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = color;
      ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.14)');
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.5, -size * 0.4, size * 0.5, size * 0.5, 0, size * 0.85);
      ctx.bezierCurveTo(-size * 0.5, size * 0.5, -size * 0.5, -size * 0.4, 0, -size);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -size * 0.85);
      ctx.lineTo(0, size * 0.7);
      ctx.stroke();
      ctx.restore();
    };

    const drawClove = (cx, cy, size, rot, color) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      ctx.moveTo(-size * 0.16, -size * 0.15);
      ctx.lineTo(-size * 0.12, size * 0.8);
      ctx.lineTo(size * 0.12, size * 0.8);
      ctx.lineTo(size * 0.16, -size * 0.15);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -size * 0.45, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawHerbLeaf = (cx, cy, size, rot, color) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = color;
      ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.12)');
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size * 0.55, -size * 0.2, 0, size);
      ctx.quadraticCurveTo(-size * 0.55, -size * 0.2, 0, -size);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -size * 0.8);
      ctx.lineTo(0, size * 0.85);
      ctx.stroke();
      ctx.restore();
    };

    const drawGrillEmber = (cx, cy, radius, colorPrefix, opacity) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `${colorPrefix}${opacity.toFixed(3)})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;
      smoothScrollY += (currentScrollY - smoothScrollY) * 0.1;
      scrollVelocity *= 0.92;

      particles.forEach((p) => {
        const dynamicSpeedY = p.speedY + scrollVelocity * 0.32;
        p.baseY -= dynamicSpeedY;
        p.phase += p.phaseSpeed;
        p.rotation += p.rotSpeed;
        p.x += Math.sin(p.phase) * p.swayAmplitude + p.speedX;

        const parallaxY = p.baseY - smoothScrollY * p.parallaxSpeed;
        const modH = height + 40;
        let renderedY = ((parallaxY % modH) + modH) % modH - 20;

        if (p.x < -30) p.x = width + 30;
        if (p.x > width + 30) p.x = -30;

        const currentOpacity = (Math.sin(p.phase) * 0.45 + 0.55) * p.maxOpacity;
        const color = `${p.colorPrefix}${currentOpacity.toFixed(3)})`;

        switch (p.type) {
          case 'star_anise':
            drawStarAnise(p.x, renderedY, p.radius, p.rotation + smoothScrollY * 0.0015, color);
            break;
          case 'cardamom':
            drawCardamom(p.x, renderedY, p.radius, p.rotation + smoothScrollY * 0.001, color);
            break;
          case 'clove':
            drawClove(p.x, renderedY, p.radius, p.rotation + smoothScrollY * 0.0015, color);
            break;
          case 'herb_leaf':
            drawHerbLeaf(p.x, renderedY, p.radius, p.rotation + Math.sin(p.phase) * 0.3, color);
            break;
          case 'ember':
          default:
            drawGrillEmber(p.x, renderedY, p.radius, p.colorPrefix, currentOpacity);
            break;
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const activeScene = useMemo(() => {
    return FOOD_SCENES.find((s) => s.key === activeSceneKey) || FOOD_SCENES[0];
  }, [activeSceneKey]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-20 overflow-hidden no-print select-none"
    >
      {/* 1. Deep Roasted Coffee Brown Base */}
      <div className="absolute inset-0 bg-[#19110B]" />

      {/* 2. Full-Screen Dynamic Food Background Image Crossfader */}
      {FOOD_SCENES.map((scene) => {
        const isActive = scene.key === activeSceneKey;
        return (
          <div
            key={scene.key}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {/* Animatic Food Image with Ken Burns breathing zoom, depth-of-field, & scroll parallax */}
            <div
              className="absolute -inset-8 bg-cover bg-center animate-food-animatic will-change-transform"
              style={{
                backgroundImage: `url(${scene.image})`,
                transform: `translate3d(0, ${scrollY * -0.06}px, 0)`,
                filter: 'blur(4px) brightness(0.55) saturate(1.1)',
              }}
            />
          </div>
        );
      })}

      {/* 3. Luxury Vignette Scrim - Softens center, ensures pristine card contrast with warm roast brown tone */}
      <div
        className="absolute inset-0 z-20"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(42, 29, 21, 0.72) 0%, rgba(28, 19, 14, 0.86) 55%, rgba(16, 11, 8, 0.98) 100%)',
        }}
      />

      {/* 4. Ambient Warm Food Glow (subtle ambient halo) */}
      <div
        className="absolute inset-0 z-20 transition-colors duration-1000 opacity-25 blur-3xl pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${activeScene.glowColor} 0%, transparent 70%)`,
        }}
      />

      {/* 5. Delicate Culinary Line-Art Watermark that shifts with scroll */}
      <div
        className="absolute inset-0 z-20 opacity-[0.035] bg-repeat pointer-events-none will-change-[background-position]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23FFFFFF' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M20 30c-5 0-9 4-9 9 0 6 5 13 14 13s14-7 14-13c0-5-4-9-9-9h-10zm-3 2h16c3 0 7 3 7 7 0 4-4 10-11 10s-11-6-11-10c0-4 4-7 7-7zm2-8c0-3 2-5 5-5s5 2 5 5h-10zm3-2c-1 0-3 1-3 2h6c0-1-2-2-3-2z'/%3E%3Cpath d='M85 15l20 20-2 2-20-20 2-2zm-2 6l5 5-2 2-5-5 2-2zm6 6l5 5-2 2-5-5 2-2zm6 6l5 5-2 2-5-5 2-2z'/%3E%3Cpath d='M25 85c0-8 6-15 15-15s15 7 15 15h2v2H23v-2h2zm2 0h26c-1-7-6-13-13-13s-12 6-13 13zm12-16c-1 0-2-1-2-2s1-2 2-2 2 1 2 2-1 2-2 2z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '90px 90px',
          backgroundPosition: `0px ${scrollY * 0.25}px`,
        }}
      />

      {/* 6. 60 FPS HTML5 Canvas with Drifting Spices, Herbs, and Aroma Embers */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-30 w-full h-full pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* 7. Subtle Floating Ambiance Scene Pill (Bottom Left) */}
      <div
        className={`fixed bottom-5 left-5 z-40 transition-all duration-500 pointer-events-none ${
          showBadge ? 'opacity-90 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-card/90 border border-gold/40 text-gold text-xs font-semibold shadow-gold-glow backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-gold animate-pulse" />
          <span>Ambiance: {activeScene.title}</span>
        </div>
      </div>
    </div>
  );
}
