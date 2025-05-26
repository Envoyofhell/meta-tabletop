<script>
   import { createEventDispatcher } from 'svelte'
   
   export let path
   export let size = 24

   let _class = ""
   export { _class as class }
   
   const dispatch = createEventDispatcher()
</script>

<svg viewBox="0 0 {size} {size}" fill="currentColor" class={_class} role="img" on:click on:keydown={e => e.key === 'Enter' && dispatch('click')}>
   <path fill-rule="evenodd" clip-rule="evenodd" d={path} />
</svg>

<style>
   svg {
      display: inline-block;
      width: 2em;
      height: 2em;
      overflow: visible;
      transform-origin: 50% 50%;
   }
</style>