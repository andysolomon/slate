import React from 'react';
import { createRoot } from 'react-dom/client';
import { Whiteboard } from './Whiteboard';
import './styles.css';

// No StrictMode: the whiteboard boots imperatively (IndexedDB seed, canvas
// binding, global listeners) in componentDidMount and a double dev-mount
// would race the first-run sample-scene seed.
createRoot(document.getElementById('root')!).render(<Whiteboard />);
