// Shared by the server layout (boot script) and the client stores. No React imports here.

export const THEME_STORAGE_KEY = 'pavement-design-theme';
/** Set to "closed" when the visitor closes the announcement strip; it then stays closed on later visits. */
export const ANNOUNCEMENT_STORAGE_KEY = 'pavement-design-announcement';

/**
 * Runs before the page paints (inlined in <head>): a stored dark choice never flashes light, and a closed
 * announcement strip never flashes into view (globals.css hides it while <html data-announcement="closed">).
 */
export const THEME_BOOT_SCRIPT =
  `try{var d=document.documentElement,t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')d.dataset.theme=t;` +
  `if(localStorage.getItem('${ANNOUNCEMENT_STORAGE_KEY}')==='closed')d.dataset.announcement='closed'}catch(e){}`;
