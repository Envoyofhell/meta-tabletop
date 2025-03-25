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
     connectionError
   } from '$lib/stores/connection.js';
 
   // Local state
   let roomId = '';
   let copyButtonText = 'Copy to Clipboard';
   let isCreating = false;
   let isJoining = false;
 
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
     });
   }
 
   /**
    * Handle creating a new room
    */
   async function handleCreateRoom() {
     isCreating = true;
     try {
       await createRoom();
     } finally {
       isCreating = false;
     }
   }
 
   /**
    * Handle joining an existing room
    */
   function handleJoinRoom() {
     if (!roomId) return;
     
     isJoining = true;
     try {
       joinRoom(roomId);
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
     }
   }
 </script>
 
 <div class="p-4 min-w-[350px] w-[min(20%,500px)] flex flex-col h-screen">
   {#if !$room}
     <!-- Not connected state -->
     <div class="text-center mb-4 italic font-bold">not connected</div>
 
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
 
         <button class="connect relative" type="submit" disabled={isJoining || !roomId}>
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
 
     <!-- Show error if any -->
     {#if $connectionError}
       <div class="mt-4 p-3 bg-red-500 text-white rounded-md">
         {$connectionError}
       </div>
     {/if}
 
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
 
     <!-- Show connection error if any -->
     {#if $connectionError}
       <div class="mt-4 p-3 bg-red-500 text-white rounded-md">
         {$connectionError}
       </div>
     {/if}
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