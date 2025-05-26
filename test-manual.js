// Manual Socket.IO protocol test
import fetch from 'node-fetch';

console.log('Testing Socket.IO protocol manually...');

async function testSocketIO() {
  try {
    // Step 1: Handshake
    console.log('1. Performing handshake...');
    const handshakeResponse = await fetch('http://localhost:8787/socket.io/?EIO=4&transport=polling');
    const handshakeData = await handshakeResponse.text();
    console.log('Handshake response:', handshakeData);
    
    // Parse session ID
    const handshakeJson = JSON.parse(handshakeData.substring(1)); // Remove '0' prefix
    const sid = handshakeJson.sid;
    console.log('Session ID:', sid);
    
    // Step 2: Get CONNECT packet
    console.log('2. Getting CONNECT packet...');
    const connectResponse = await fetch(`http://localhost:8787/socket.io/?EIO=4&transport=polling&sid=${sid}`);
    const connectData = await connectResponse.text();
    console.log('CONNECT response:', connectData);
    
    // Step 3: Send createRoom event
    console.log('3. Sending createRoom event...');
    const eventData = '42["createRoom"]'; // Engine.IO MESSAGE (4) + Socket.IO EVENT (2) + data
    const postResponse = await fetch(`http://localhost:8787/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: `${eventData.length}:${eventData}`
    });
    const postResult = await postResponse.text();
    console.log('POST response:', postResult);
    
    // Step 4: Poll for response
    console.log('4. Polling for room creation response...');
    const pollResponse = await fetch(`http://localhost:8787/socket.io/?EIO=4&transport=polling&sid=${sid}`);
    const pollData = await pollResponse.text();
    console.log('Poll response:', pollData);
    
    console.log('✅ Manual test completed successfully!');
    
  } catch (error) {
    console.error('❌ Manual test failed:', error);
  }
}

testSocketIO(); 