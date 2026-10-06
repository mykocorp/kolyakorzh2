import { useRef, useState, useEffect } from 'react';
import Links from './imports/links';

interface BlokData {
  id: number;
  text: string;
  progress: number; // 0-1 around perimeter
  speed: number;
}

// Constants
const GREEN_BOX = {
  width: 476,
  height: 266,
} as const;

const BLOK_HEIGHT = 56;
const CHAR_WIDTH = 36;
const BLOK_PADDING = 12;
const MIN_GAP = 0.01; // minimum gap between bloks as fraction of perimeter

// Yellow container dimensions (green box + swimlanes on all sides)
const CONTAINER = {
  width: GREEN_BOX.width + (BLOK_HEIGHT * 2),  // 476 + 112 = 588
  height: GREEN_BOX.height + (BLOK_HEIGHT * 2), // 266 + 112 = 378
} as const;

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [containerPos, setContainerPos] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(true);
  const [currentView, setCurrentView] = useState<'kinetic' | 'links'>('kinetic');
  const [activeBlokId, setActiveBlokId] = useState<number | null>(null);
  
  const letterCycle = ['m', 'y', 'k', 'o', 'l', 'a', 'k', 'o', 'r', 'z', 'h'];
  const [letterIndices, setLetterIndices] = useState([0, 1, 2, 3]); // indices into letterCycle - starts as "myko"
  
  const [bloks, setBloks] = useState<BlokData[]>([
    { id: 1, text: 'ABCDEG', progress: 0.1, speed: 0.00005 },
    { id: 2, text: 'ABD789', progress: 0.3, speed: 0.00006 },
    { id: 3, text: '12DEFG', progress: 0.5, speed: 0.000055 },
    { id: 4, text: '123456', progress: 0.7, speed: 0.000065 },
    { id: 5, text: 'LINKS', progress: 0.85, speed: 0.00007 },
  ]);

  useEffect(() => {
    if (!isAnimating) return;
    
    let animationFrameId: number;
    let lastTime = performance.now();
    const perimeter = 2 * (GREEN_BOX.width + GREEN_BOX.height);

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      setBloks(prevBloks => {
        // Calculate new positions
        const newBloks = prevBloks.map(blok => ({
          ...blok,
          progress: (blok.progress + blok.speed * deltaTime) % 1,
        }));
        
        // Sort by progress for collision detection
        const sorted = [...newBloks].sort((a, b) => a.progress - b.progress);
        
        // Collision detection and adjustment
        for (let i = 0; i < sorted.length; i++) {
          const current = sorted[i];
          const next = sorted[(i + 1) % sorted.length];
          
          const currentLength = (current.text.length * CHAR_WIDTH) / perimeter;
          
          // Calculate distance to next blok (accounting for wrap-around)
          let distanceToNext = next.progress - current.progress;
          if (distanceToNext < 0) distanceToNext += 1;
          
          // If too close, adjust current blok's position
          const requiredDistance = currentLength + MIN_GAP;
          if (distanceToNext < requiredDistance) {
            current.progress = (next.progress - requiredDistance + 1) % 1;
          }
        }
        
        return newBloks;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isAnimating]);

  const handleBlueSquareMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - containerPos.x, y: e.clientY - containerPos.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setContainerPos({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleYellowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(!isAnimating);
  };

  const handleLetterHover = (index: number) => {
    setLetterIndices(prev => {
      const newIndices = [...prev];
      newIndices[index] = (newIndices[index] + 1) % letterCycle.length;
      return newIndices;
    });
  };

  const handleBlokClick = (blokId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const blok = bloks.find(b => b.id === blokId);
    if (blok && blok.text === 'LINKS') {
      setCurrentView('links');
      setActiveBlokId(blokId);
    }
  };

  const handleTitleClick = () => {
    setCurrentView('kinetic');
    setActiveBlokId(null);
  };

  // Calculate position and visibility for each character in a blok
  const getBlokRenderData = (blok: BlokData) => {
    const perimeter = 2 * (GREEN_BOX.width + GREEN_BOX.height);
    
    const segments: Array<{
      chars: string;
      x: number;
      y: number;
      rotation: number;
    }> = [];

    // Calculate starting distance for the blok
    const startDistance = blok.progress * perimeter;
    
    // Calculate character positions
    const charPositions: Array<{
      char: string;
      distance: number;
    }> = [];
    
    for (let i = 0; i < blok.text.length; i++) {
      const charDist = (startDistance + i * CHAR_WIDTH) % perimeter;
      charPositions.push({
        char: blok.text[i],
        distance: charDist
      });
    }

    // Determine which side each character is on
    const getSide = (dist: number) => {
      if (dist < GREEN_BOX.width) return 0; // top
      if (dist < GREEN_BOX.width + GREEN_BOX.height) return 1; // right
      if (dist < GREEN_BOX.width * 2 + GREEN_BOX.height) return 2; // bottom
      return 3; // left
    };

    // Group consecutive characters on the same side
    let currentSide = getSide(charPositions[0].distance);
    let currentChars = charPositions[0].char;
    let segmentStartDist = charPositions[0].distance;

    for (let i = 1; i < charPositions.length; i++) {
      const side = getSide(charPositions[i].distance);
      
      if (side === currentSide) {
        currentChars += charPositions[i].char;
      } else {
        // Push the current segment
        const segmentData = getSegmentPosition(currentSide, segmentStartDist);
        segments.push({
          chars: currentChars,
          ...segmentData
        });
        
        // Start a new segment
        currentSide = side;
        currentChars = charPositions[i].char;
        segmentStartDist = charPositions[i].distance;
      }
    }

    // Push the last segment
    const segmentData = getSegmentPosition(currentSide, segmentStartDist);
    segments.push({
      chars: currentChars,
      ...segmentData
    });

    return segments;
  };

  const getSegmentPosition = (side: number, distance: number) => {
    switch (side) {
      case 0: // top - outside the green box
        return {
          x: distance,
          y: -BLOK_HEIGHT,
          rotation: 0
        };
      case 1: // right - outside the green box
        const rightDist = distance - GREEN_BOX.width;
        return {
          x: GREEN_BOX.width + BLOK_HEIGHT,
          y: rightDist,
          rotation: 90
        };
      case 2: // bottom - outside the green box
        const bottomDist = distance - GREEN_BOX.width - GREEN_BOX.height;
        return {
          x: GREEN_BOX.width - bottomDist,
          y: GREEN_BOX.height + BLOK_HEIGHT,
          rotation: 180
        };
      case 3: // left - outside the green box
        const leftDist = distance - GREEN_BOX.width * 2 - GREEN_BOX.height;
        return {
          x: -BLOK_HEIGHT,
          y: GREEN_BOX.height - leftDist,
          rotation: 270
        };
      default:
        return { x: 0, y: 0, rotation: 0 };
    }
  };

  return (
    <div 
      className="bg-white relative size-full overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Links page background */}
      {currentView === 'links' && (
        <div className="absolute inset-0">
          <Links />
        </div>
      )}

      {/* Kinetic block - always floating on top */}
      <div
        ref={containerRef}
        style={{
          transform: `translate(calc(-50% + ${containerPos.x}px), calc(-50% + ${containerPos.y}px))`,
          position: 'absolute',
          left: '50%',
          top: '50%',
          zIndex: 100,
        }}
      >
        {/* Yellow background */}
        <div 
          className="absolute bg-[yellow]"
          onClick={handleYellowClick}
          style={{
            width: CONTAINER.width,
            height: CONTAINER.height,
            left: 0,
            top: 0,
            cursor: 'pointer',
          }}
        />
        
        {/* Green section */}
        <div 
          className="absolute bg-[#139d23]"
          style={{
            width: GREEN_BOX.width,
            height: GREEN_BOX.height,
            left: BLOK_HEIGHT,
            top: BLOK_HEIGHT,
          }}
        />
        
        {/* Letter text - each letter independently hoverable with monospace font */}
        <div 
          className="absolute not-italic text-black flex items-center justify-center"
          onClick={handleTitleClick}
          style={{
            fontFamily: 'monospace',
            fontSize: 140,
            lineHeight: 'normal',
            width: GREEN_BOX.width,
            height: GREEN_BOX.height,
            left: BLOK_HEIGHT,
            top: BLOK_HEIGHT,
            cursor: 'pointer',
          }}
        >
          {letterIndices.map((idx, i) => (
            <span 
              key={i}
              onMouseEnter={() => handleLetterHover(i)}
            >
              {letterCycle[idx]}
            </span>
          ))}
        </div>

        {/* Animated bloks */}
        {bloks.map(blok => {
          const segments = getBlokRenderData(blok);
          const isClickable = blok.text === 'LINKS';
          const isActive = blok.id === activeBlokId;
          return segments.map((segment, idx) => (
            <div
              key={`${blok.id}-${idx}`}
              className="absolute box-border flex items-center"
              onClick={isClickable ? (e) => handleBlokClick(blok.id, e) : undefined}
              style={{
                left: BLOK_HEIGHT + segment.x,
                top: BLOK_HEIGHT + segment.y,
                transform: `rotate(${segment.rotation}deg)`,
                transformOrigin: 'top left',
                paddingLeft: BLOK_PADDING,
                paddingRight: BLOK_PADDING,
                height: BLOK_HEIGHT,
                cursor: isClickable ? 'pointer' : 'default',
                backgroundColor: isActive ? '#d4ff5b' : '#fe4145',
              }}
            >
              <p className="font-['PP_Frama:Regular',sans-serif] not-italic text-nowrap whitespace-pre m-0"
                 style={{ 
                   fontSize: BLOK_HEIGHT, 
                   lineHeight: '1',
                   color: isActive ? '#139d23' : 'black',
                 }}>
                {segment.chars}
              </p>
            </div>
          ));
        })}

        {/* Blue square drag handle - part of the object, positioned at top-left */}
        <div
          className="absolute bg-blue-600"
          onMouseDown={handleBlueSquareMouseDown}
          style={{
            width: BLOK_HEIGHT,
            height: BLOK_HEIGHT,
            left: 0,
            top: 0,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        />
      </div>
    </div>
  );
}