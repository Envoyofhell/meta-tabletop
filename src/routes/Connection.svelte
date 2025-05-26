<!-- 
  File: meta-tabletop/src/routes/Connection.svelte
  Project: CLIENT
  Purpose: Component for managing connection to game rooms
-->

<script>
   import Chat from './Chat.svelte';
   import Spinner from './Spinner.svelte';
   import { 
     connected, 
     room, 
     createRoom, 
     joinRoom, 
     leaveRoom,
     connect
   } from '$lib/stores/connection.js';
 
   // Local state
   let roomId = '';
   let copyButtonText = 'Copy to Clipboard';
   let isCreating = false;
   let isJoining = false;
   let connectionError = '';
   let showConnectionStatus = false;
 
   // Show connection status for a few seconds when it changes
   $: if ($connected !== undefined) {
     showConnectionStatus = true;
     setTimeout(() => {
       showConnectionStatus = false;
     }, 3000);
   }
 
   /**
    * Copy room ID to clipboard
    */
   function copyToClipboard() {
     if (!$room) return;
     
     navigator.clipboard.writeText($room).then(() => {
       copyButtonText = 'Copied!';
       setTimeout(() => {
         copyButtonText = 'Copy to Clipboard';
       }, 3000);
     }).catch(err => {
       console.error('Could not copy text:', err);
       copyButtonText = 'Copy failed';
       setTimeout(() => {
         copyButtonText = 'Copy to Clipboard';
       }, 3000);
     });
   }
 
   /**
    * Handle creating a new room
    */
   async function handleCreateRoom() {
     isCreating = true;
     connectionError = '';
     
     try {
       // Ensure we're connected first
       if (!$connected) {
         connect();
         // Wait a moment for connection
         await new Promise(resolve => setTimeout(resolve, 2000));
       }
       
       if (!$connected) {
         throw new Error('Unable to connect to server');
       }
       
       createRoom();
       
       // Wait for room creation confirmation
       await new Promise((resolve, reject) => {
         const timeout = setTimeout(() => {
           reject(new Error('Room creation timed out'));
         }, 10000);
         
         const unsubscribe = room.subscribe(value => {
           if (value) {
             clearTimeout(timeout);
             unsubscribe();
             resolve();
           }
         });
       });
       
     } catch (error) {
       console.error('Room creation failed:', error);
       connectionError = error.message || 'Failed to create room';
     } finally {
       isCreating = false;
     }
   }
 
   /**
    * Handle joining an existing room
    */
   async function handleJoinRoom() {
     if (!roomId.trim()) return;
     
     isJoining = true;
     connectionError = '';
     
     try {
       // Ensure we're connected first
       if (!$connected) {
         connect();
         // Wait a moment for connection
         await new Promise(resolve => setTimeout(resolve, 2000));
       }
       
       if (!$connected) {
         throw new Error('Unable to connect to server');
       }
       
       joinRoom(roomId.trim());
       
       // Wait for room join confirmation
       await new Promise((resolve, reject) => {
         const timeout = setTimeout(() => {
           reject(new Error('Room join timed out'));
         }, 10000);
         
         const unsubscribe = room.subscribe(value => {
           if (value === roomId.trim()) {
             clearTimeout(timeout);
             unsubscribe();
             resolve();
           }
         });
       });
       
       roomId = ''; // Clear input on success
       
     } catch (error) {
       console.error('Room join failed:', error);
       connectionError = error.message || 'Failed to join room';
     } finally {
       isJoining = false;
     }
   }
 
   /**
    * Confirm and leave room
    */
   function handleLeaveRoom() {
     if (window.confirm('Are you sure you want to leave this room?')) {
       leaveRoom();
       connectionError = '';
     }
   }
 
   /**
    * Manual connection attempt
    */
   function handleConnect() {
     connectionError = '';
     connect();
   }
 </script>
 
 <div class="p-4 min-w-[350px] w-[min(20%,500px)] flex flex-col h-screen">
   
       <!-- Connection Status Banner -->
    {#if showConnectionStatus}
      <div class="mb-3 p-2 rounded-md text-center text-sm font-bold transition-all duration-300 text-white" 
           class:bg-green-500={$connected} 
           class:bg-red-500={!$connected}>
        {$connected ? '✓ Connected to server' : '✗ Disconnected from server'}
      </div>
    {/if}
 
   <!-- Error Display -->
   {#if connectionError}
     <div class="mb-3 p-3 bg-red-500 text-white rounded-md text-sm">
       <strong>Error:</strong> {connectionError}
       <button class="ml-2 underline" on:click={() => connectionError = ''}>Dismiss</button>
     </div>
   {/if}
 
   {#if !$room}
     <!-- Not connected state -->
     <div class="text-center mb-4 italic font-bold">
       {#if $connected}
         ready to play
       {:else}
         not connected
       {/if}
     </div>
 
     <!-- Manual connect button if not connected -->
     {#if !$connected}
       <button class="connect mb-3" on:click={handleConnect}>
         Connect to Server
       </button>
       <hr class="mb-3">
     {/if}
 
     <div class="flex flex-col justify-center gap-3">
       <!-- Create room button -->
       <button 
         class="connect relative" 
         on:click={handleCreateRoom} 
         disabled={isCreating}
       >
         {#if isCreating}
           <span class="opacity-0">Create Room</span>
           <span class="absolute inset-0 flex justify-center items-center">
             <Spinner />
             Creating...
           </span>
         {:else}
           Create Room
         {/if}
       </button>
       
       <hr>
       
       <!-- Join room form -->
       <form class="flex flex-col gap-2" on:submit|preventDefault={handleJoinRoom}>
         <input
           class="p-2 border border-[var(--bg-color-three)] rounded-lg"
           type="text" 
           name="roomId" 
           bind:value={roomId} 
           placeholder="Room ID" 
           on:keydown|stopPropagation
           disabled={isJoining}
           required
         >
 
         <button class="connect relative" type="submit" disabled={isJoining || !roomId.trim()}>
           {#if isJoining}
             <span class="opacity-0">Join Room</span>
             <span class="absolute inset-0 flex justify-center items-center">
               <Spinner />
               Joining...
             </span>
           {:else}
             Join Room
           {/if}
         </button>
       </form>
     </div>
 
   {:else}
     <!-- Connected state -->
     <div class="flex flex-col gap-1 mb-5">
       <div class="text-center font-bold">
         {#if $connected}
           connected to
         {:else}
           <div class="flex gap-3 items-center justify-center bg-yellow-400 text-black p-1 rounded-md mb-2">
             lost connection
             <Spinner />
           </div>
         {/if}
         <div class="text-sm text-[var(--text-color-two)]">{$room}</div>
       </div>
 
       <!-- Copy room ID button -->
       <button
         class="self-center py-1 px-2 primary rounded-md text-sm font-bold"
         on:click={copyToClipboard}>
           {copyButtonText}
       </button>
     </div>
 
     <!-- Chat component -->
     <Chat />
 
     <!-- Leave room button -->
     <button class="mt-4 text-center" on:click={handleLeaveRoom}>Leave Room</button>
   {/if}
 </div>
 
 <style>
   button.connect {
     @apply py-2 px-3 font-bold text-white bg-[var(--primary-color)] rounded-lg;
     transition: opacity 0.2s;
   }
   
   button.connect:disabled {
     opacity: 0.7;
     cursor: not-allowed;
   }
 </style>