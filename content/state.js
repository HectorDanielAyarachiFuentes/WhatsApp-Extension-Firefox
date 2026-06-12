/**
 * @file content/state.js
 * @description Defines window.WA. Contains constants, selectors, and shared state (cachedMiniChats, isChatListCollapsed).
 * @context Part of the content script injected into web.whatsapp.com.
 */
window.WA = window.WA || {};

window.WA.BLACKLIST = ['archivados', 'archived', 'comunidades', 'communities'];

window.WA.SELECTORS = {
  chatListContainer: '#pane-side, #side, [data-testid="chat-list"], [aria-label="Lista de chats"]',
  chatRow: '[data-testid="cell-frame-container"], [data-testid="list-item-chat"], [role="row"], [role="listitem"], [role="option"]',
  chatTitle: '[data-testid="cell-frame-title"] span, span[title]',
  unreadBadge: '[aria-label*="no leíd"], [aria-label*="unread"], [aria-label*="sin leer"], [data-testid="icon-unread-count"]',
  secondaryContent: '[data-testid="cell-frame-secondary"]',
  primaryDetail: '[data-testid="cell-frame-primary-detail"]',
  communitiesBtn: '[aria-label="Comunidades"], [title="Comunidades"], [aria-label="Communities"], [title="Communities"]',
  headerIcons: 'header span[data-icon]'
};

window.WA.state = {
  isChatListCollapsed: false,
  previousActiveChatsNames: '',
  ignoredContacts: new Map(),
  cachedMiniChats: []
};
