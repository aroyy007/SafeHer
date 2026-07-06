import React, { useState, useRef, useEffect } from 'react';
import { useEmergency } from '../../contexts/EmergencyContext';

// A functional calculator UI that hides the real app
export function DisguiseMode({ onExit }) {
  const { activateSOS, isEmergency } = useEmergency();
  const [display, setDisplay] = useState('0');
  
  // Secret code to exit disguise mode
  const SECRET_CODE = "1234=";
  const [inputBuffer, setInputBuffer] = useState("");

  const holdTimerRef = useRef(null);

  const handlePress = (val) => {
    // Standard calc update
    if (display === '0') setDisplay(val);
    else setDisplay(display + val);

    // Buffer for secret exit code
    const newBuffer = (inputBuffer + val).slice(-5);
    setInputBuffer(newBuffer);
    
    if (newBuffer === SECRET_CODE) {
      onExit();
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setInputBuffer('');
  };

  // Holding the '=' button triggers SOS silently
  const startEqualHold = () => {
    holdTimerRef.current = setTimeout(() => {
      console.log("🚨 DISGUISE SOS ACTIVATED SILENTLY 🚨");
      activateSOS();
      // Vibrate shortly as a silent confirmation
      if (navigator.vibrate) navigator.vibrate([100]); 
    }, 3000);
  };

  const cancelEqualHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: '#1c1c1c',
      color: 'white',
      fontFamily: '-apple-system, sans-serif'
    }}>
      {/* Display */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: '2rem',
        fontSize: '4rem',
        fontWeight: '300'
      }}>
        {display}
      </div>

      {/* Optional: Tiny indicator if SOS is secretly running */}
      {isEmergency && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 4, height: 4, borderRadius: '50%', background: 'red' }} />
      )}

      {/* Keypad */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px',
        background: '#000',
        paddingTop: '1px'
      }}>
        {/* Row 1 */}
        <CalcBtn label="AC" onClick={handleClear} bg="#d4d4d2" color="#1c1c1c" />
        <CalcBtn label="+/-" onClick={() => {}} bg="#d4d4d2" color="#1c1c1c" />
        <CalcBtn label="%" onClick={() => {}} bg="#d4d4d2" color="#1c1c1c" />
        <CalcBtn label="÷" onClick={() => handlePress('/')} bg="#ff9500" />
        
        {/* Row 2 */}
        <CalcBtn label="7" onClick={() => handlePress('7')} />
        <CalcBtn label="8" onClick={() => handlePress('8')} />
        <CalcBtn label="9" onClick={() => handlePress('9')} />
        <CalcBtn label="×" onClick={() => handlePress('*')} bg="#ff9500" />
        
        {/* Row 3 */}
        <CalcBtn label="4" onClick={() => handlePress('4')} />
        <CalcBtn label="5" onClick={() => handlePress('5')} />
        <CalcBtn label="6" onClick={() => handlePress('6')} />
        <CalcBtn label="-" onClick={() => handlePress('-')} bg="#ff9500" />
        
        {/* Row 4 */}
        <CalcBtn label="1" onClick={() => handlePress('1')} />
        <CalcBtn label="2" onClick={() => handlePress('2')} />
        <CalcBtn label="3" onClick={() => handlePress('3')} />
        <CalcBtn label="+" onClick={() => handlePress('+')} bg="#ff9500" />
        
        {/* Row 5 */}
        <CalcBtn label="0" onClick={() => handlePress('0')} span={2} />
        <CalcBtn label="." onClick={() => handlePress('.')} />
        <CalcBtn 
          label="=" 
          onClick={() => handlePress('=')} 
          onPointerDown={startEqualHold}
          onPointerUp={cancelEqualHold}
          onPointerLeave={cancelEqualHold}
          bg="#ff9500" 
        />
      </div>
    </div>
  );
}

function CalcBtn({ label, onClick, onPointerDown, onPointerUp, onPointerLeave, bg = '#505050', color = 'white', span = 1 }) {
  return (
    <button 
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      style={{
        background: bg,
        color: color,
        gridColumn: `span ${span}`,
        padding: '1.5rem',
        fontSize: '2rem',
        border: 'none',
        outline: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: span === 2 ? 'flex-start' : 'center',
        paddingLeft: span === 2 ? '2rem' : '0',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {label}
    </button>
  );
}
