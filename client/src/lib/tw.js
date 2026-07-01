/**
 * Shared Tailwind class strings. Design tokens live in `index.css` :root.
 * Use `text-[color:var(--text-muted)]` etc. for theme colors.
 */

export const twBtnBase =
  'inline-flex items-center justify-center gap-2 rounded-[length:var(--radius-sm)] border-0 font-inherit text-[0.92rem] font-semibold cursor-pointer transition-[transform,box-shadow,opacity] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';

export const twBtnPrimary =
  `${twBtnBase} mt-3 w-full bg-gradient-to-br from-sky-300 via-sky-400 to-sky-600 text-[#0c1222] shadow-[0_4px_20px_rgba(56,189,248,0.35)] hover:shadow-[0_6px_28px_rgba(56,189,248,0.45)]`;

export const twBtnPrimarySm = `${twBtnPrimary} mt-0 w-auto min-w-[120px] px-3 py-1.5 text-[0.78rem]`;

export const twBtnGhost =
  `${twBtnBase} border border-[color:var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[0.88rem] font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] hover:border-white/16`;

export const twBtnGhostSm = `${twBtnGhost} px-3 py-1.5 text-[0.78rem]`;

export const twBtnDanger =
  `${twBtnBase} border border-red-400/25 bg-[var(--danger-bg)] px-3.5 py-2 text-[0.82rem] font-semibold text-[var(--danger)] hover:bg-red-400/20`;

export const twBtnDangerSm = `${twBtnDanger} px-3 py-1.5 text-[0.78rem]`;

export const twField = 'field mb-1 flex flex-col gap-2';

export const twFieldLabel =
  'text-[0.8rem] font-semibold text-[color:var(--text-muted)]';

export const twInputMono =
  "font-[ui-monospace,'Cascadia_Mono','Consolas',monospace] tracking-[0.08em]";

export const twTextarea =
  'min-h-[4.5rem] w-full resize-y rounded-[length:var(--radius-sm)] border border-[color:var(--border)] bg-[rgba(15,23,42,0.65)] px-3.5 py-2.5 text-[var(--text)] outline-none transition focus:border-sky-400/55 focus:bg-[rgba(15,23,42,0.85)] focus:shadow-[var(--ring)]';

export const twCard =
  'rounded-[length:var(--radius-md)] border border-[color:var(--border)] bg-gradient-to-b from-slate-800/55 to-slate-900/70 px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)]';

export const twAlertError =
  'mt-2 rounded-[length:var(--radius-sm)] border border-red-400/25 bg-red-950/35 px-3 py-2.5 text-[0.875rem] leading-snug text-red-200';

export const twAlertSuccess =
  'mt-2 rounded-[length:var(--radius-sm)] border border-emerald-400/25 bg-[var(--success-bg)] px-3 py-2.5 text-[0.875rem] leading-snug text-emerald-200';

export const twMuted = 'text-[color:var(--text-muted)]';

export const twCellMono = 'font-mono tabular-nums';

export const twTable =
  'w-full border-collapse text-left text-[0.88rem] [&_thead]:bg-white/[0.04] [&_th]:border-b [&_th]:border-[color:var(--border)] [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-[0.72rem] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-[color:var(--text-faint)] [&_td]:border-b [&_td]:border-[color:var(--border)] [&_td]:px-3 [&_td]:py-2.5 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-white/[0.03]';

export const twTableCompact =
  `${twTable} [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_td]:text-[0.82rem] [&_th]:text-[0.72rem]`;

export const twModalBackdrop =
  'fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm';

export const twModalDialog =
  'max-h-[min(90vh,560px)] w-[min(420px,100%)] overflow-auto rounded-[length:var(--radius-lg)] border border-[color:var(--border)] bg-gradient-to-br from-slate-800/95 to-slate-900/98 px-6 py-5 shadow-[var(--shadow-lg)]';

export const twModalOrder =
  'max-h-[min(92vh,640px)] w-[min(560px,100%)] overflow-auto rounded-[length:var(--radius-lg)] border border-[color:var(--border)] bg-gradient-to-br from-slate-800/95 to-slate-900/98 px-6 py-5 shadow-[var(--shadow-lg)]';

export const twModalTitle = 'm-0 mb-4 text-[1.1rem] font-bold text-[var(--text)]';

export const twModalActions =
  'modal-actions mt-[18px] flex flex-nowrap items-center justify-end gap-2.5 [&_button]:mt-0 [&_button]:w-auto [&_button]:shrink-0';

export const twFabPlus =
  'grid size-[52px] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-[linear-gradient(135deg,#7dd3fc_0%,var(--accent)_50%,var(--accent-strong)_100%)] text-[#0c1222] shadow-[0_6px_24px_rgba(56,189,248,0.45)] transition-[transform,box-shadow] duration-150 hover:shadow-[0_8px_32px_rgba(56,189,248,0.55)] focus-visible:shadow-[var(--ring),0_6px_24px_rgba(56,189,248,0.45)] focus-visible:outline-none active:scale-[0.96]';

export const twFabPlusInner = 'text-[1.35rem] leading-none';

export const twLinkText =
  'border-0 bg-transparent p-0 text-[0.88rem] font-semibold text-[var(--accent)] underline decoration-transparent underline-offset-[3px] transition hover:text-sky-300';

export const twPaginationBar =
  'mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5';

export const twPaginationMeta = 'text-[0.85rem] text-[color:var(--text-muted)]';

export const twPaginationActions = 'flex gap-2';

export const twEmptyHint = 'py-3 text-[0.88rem] text-[color:var(--text-muted)]';

export const twSectionTitle = 'm-0 text-[1.35rem] font-bold tracking-tight text-[var(--text)]';

export const twSectionTitleSm = 'm-0 text-[0.95rem] font-bold text-[var(--text)]';

export const twSectionDescTight = 'mb-3 text-[0.88rem] leading-snug text-[color:var(--text-muted)]';

export const twTableStrong = 'font-semibold text-[var(--text)]';

export const twTableWrap = 'mt-2 overflow-x-auto';

export const twTableWrapBordered =
  `${twTableWrap} max-w-full min-w-0 rounded-[length:var(--radius-sm)] border border-[color:var(--border)]`;

export const twOrdersListTableWrap =
  `${twTableWrapBordered} orders-list-table-scroll`;

export const twTableActions = 'w-24 text-right';

export const twTableActionGroup =
  'inline-flex overflow-hidden rounded-[length:var(--radius-sm)] border border-[color:var(--border)] align-middle';

export const twTableIconBtnGhost =
  `${twBtnGhostSm} min-w-[2.35rem] rounded-none border-0 shadow-none first:rounded-l-[length:var(--radius-sm)] last:rounded-r-[length:var(--radius-sm)] [&+&]:border-l [&+&]:border-[color:var(--border)]`;

export const twTableIconBtnDanger =
  `${twBtnDangerSm} min-w-[2.35rem] rounded-none border-0 shadow-none first:rounded-l-[length:var(--radius-sm)] last:rounded-r-[length:var(--radius-sm)] [&+&]:border-l [&+&]:border-[color:var(--border)]`;

export const twFilterBar =
  'mt-3 flex flex-wrap items-end gap-3';

export const twFilterField = 'flex min-w-[140px] flex-col gap-2';

export const twFilterGrow = 'min-w-0 flex-1';

export const twFilterSearch = 'w-full min-w-0';

/** Orders list filters (shared pattern with products search bar) */
export const twOrdersFilterBar =
  'mb-1 mt-3 flex flex-wrap items-end gap-x-4 gap-y-3';

export const twOrdersFilterField = 'flex min-w-0 flex-col gap-1';

export const twOrdersFilterGrow = 'min-w-[160px] flex-1 basis-[200px]';

export const twOrdersFilterSelect =
  'max-w-full min-w-[140px] rounded-[length:var(--radius-sm)] border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-2 text-inherit text-[var(--text)] outline-none focus:shadow-[var(--ring)]';

export const twOrdersFilterSearch =
  'min-w-0 w-full rounded-[length:var(--radius-sm)] border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-2 text-inherit text-[var(--text)] outline-none focus:border-sky-400/35 focus:shadow-[var(--ring)]';

export const twUsersTableHead = 'mb-1 flex flex-wrap items-center justify-between gap-3';

export const twUsersPageSize = 'flex items-center gap-2';

export const twProductsPage = 'relative flex flex-col gap-4';

export const twProductsPageHeader = 'flex items-start justify-between gap-4';

export const twShellLogin =
  'flex min-h-dvh flex-1 items-center justify-center p-[clamp(20px,4vw,40px)]';

export const twLoginCard =
  'w-[min(440px,100%)] rounded-[length:var(--radius-lg)] border border-[color:var(--border)] bg-gradient-to-br from-slate-800/85 to-slate-900/90 p-[clamp(28px,4vw,36px)] shadow-[var(--shadow-lg),var(--shadow-card)] backdrop-blur-xl';

export const twLoginBrand = 'mb-7 flex items-center gap-3.5';

export const twLoginLogo =
  'grid size-12 place-items-center rounded-[14px] bg-gradient-to-br from-sky-400 to-indigo-400 text-[#0c1222] shadow-[0_8px_24px_rgba(56,189,248,0.35)]';

export const twLoginLogoFa = 'text-2xl leading-none';

export const twLoginEyebrow =
  'm-0 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--accent)]';

export const twLoginTitle =
  'mt-1 text-[1.65rem] font-bold leading-tight tracking-tight text-[var(--text)]';

export const twLoginSub =
  'mt-2.5 text-[0.9rem] leading-relaxed text-[color:var(--text-muted)]';

export const twLoginForm = 'mt-7 flex flex-col gap-1';

export const twLinkRow = 'mt-1 mb-0.5 flex justify-end';

export const twLinkRowSpaced =
  'mt-3.5 flex flex-wrap justify-between gap-2';

export const twShellApp =
  'flex min-h-dvh w-full flex-none items-stretch justify-start p-0 sm:p-[clamp(16px,3vw,28px)]';

export const twAppLayout = 'flex w-full min-w-0 flex-none flex-col sm:flex-row';

export const twSidebar =
  'fixed bottom-0 left-0 top-0 z-30 flex w-[248px] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-b border-[color:var(--border)] bg-gradient-to-b from-slate-900/98 to-[#0c1222]/99 px-3.5 pb-4 pt-5 shadow-[4px_0_32px_rgba(0,0,0,0.25)] sm:relative sm:w-[248px] sm:flex-row sm:flex-wrap sm:items-center sm:border-b-0 sm:border-r';

export const twSidebarBrand =
  'mb-2 flex items-center gap-3 border-b border-white/[0.06] px-2.5 pb-5 sm:mb-0 sm:flex-1 sm:border-b-0 sm:pb-0';

export const twSidebarBrandMark =
  'grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-400 text-[0.75rem] font-extrabold text-[#0c1222]';

export const twSidebarBrandText =
  'min-w-0 truncate text-[0.95rem] font-bold leading-tight tracking-tight text-[var(--text)]';

export const twSidebarNav =
  'flex flex-1 flex-col gap-1 sm:flex-[1_1_100%] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-1.5';

export const twSidebarFooter =
  'mt-auto border-t border-white/[0.06] pt-3 sm:mt-0 sm:border-t-0 sm:pt-0';

export const twSidebarLink =
  'flex w-full cursor-pointer items-center gap-3 rounded-[length:var(--radius-sm)] border-0 bg-transparent px-3 py-2.5 text-left text-[0.9rem] font-semibold text-[color:var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-w-0 sm:flex-1 sm:justify-center sm:px-2 sm:py-2.5 sm:text-[0.78rem]';

export const twSidebarLinkActive =
  `${twSidebarLink} bg-[var(--accent-dim)] text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.25)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]`;

export const twSidebarLinkLogout =
  `${twSidebarLink} text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-red-200`;

export const twSidebarLinkIcon =
  'flex w-5 shrink-0 items-center justify-center text-inherit opacity-90 sm:hidden';

export const twSidebarFa = 'w-5 text-center text-[1.05rem] leading-none';

export const twDashboardMain =
  'box-border flex min-w-0 flex-1 flex-col gap-5 overflow-x-clip p-[clamp(16px,2vw,28px)] sm:ml-[248px] sm:w-[calc(100%-248px)]';

export const twTopbar =
  'sticky top-0 z-[100] flex shrink-0 flex-wrap items-start justify-between gap-4 rounded-[length:var(--radius-lg)] border border-[color:var(--border)] bg-gradient-to-br from-slate-800/75 to-slate-900/90 px-5 py-4 shadow-[var(--shadow-card)] backdrop-blur-md';

export const twTopbarTitle =
  'm-0 text-[1.35rem] font-bold tracking-tight text-[var(--text)]';

export const twTopbarSubtitle = 'mt-1.5 text-[0.88rem] text-[color:var(--text-muted)]';

export const twDashboardContent =
  'mx-auto flex w-full max-w-[1120px] flex-col gap-4 overflow-x-hidden';

export const twProfileMenuRoot = 'relative z-[2]';

export const twProfileMenuTrigger =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[var(--surface)] p-1 text-[var(--text)] transition hover:bg-[var(--surface-2)] focus-visible:shadow-[var(--ring)] focus-visible:outline-none';

export const twProfileMenuAvatar =
  'grid size-[38px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 text-[0.82rem] font-extrabold text-[#0c1222]';

export const twProfileMenuChevron =
  'flex items-center px-2 pl-0.5 text-[color:var(--text-muted)]';

export const twProfileMenuDropdown =
  'absolute right-0 top-[calc(100%+8px)] z-[1000] min-w-[200px] rounded-[length:var(--radius-sm)] border border-[color:var(--border)] bg-[rgba(15,23,42,0.98)] p-1.5 shadow-[var(--shadow-lg)]';

export const twProfileMenuItem =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-[0.88rem] font-medium text-[var(--text)] hover:bg-[var(--surface)]';

export const twProfileMenuItemDanger =
  `${twProfileMenuItem} text-red-200 hover:bg-[var(--danger-bg)]`;

export const twProfileMenuSep = 'mx-1 my-1.5 h-px bg-white/[0.08]';

export const twProfileMenuItemIcon =
  'w-[1.1rem] shrink-0 text-center text-[0.85rem] opacity-90';

export const twStatGrid =
  'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4';

export const twStatCard =
  'flex cursor-pointer flex-col items-start gap-1 rounded-[length:var(--radius-md)] border border-[color:var(--border)] bg-gradient-to-br from-slate-800/55 to-slate-900/75 px-[18px] pb-4 pt-[18px] text-left font-inherit text-inherit shadow-[var(--shadow-card)] transition hover:border-sky-400/35 active:scale-[0.99] disabled:cursor-default disabled:opacity-85';

export const twStatCardLabel =
  'text-[0.72rem] font-bold uppercase tracking-wider text-[color:var(--text-faint)]';

export const twStatCardValue =
  'text-[1.75rem] font-extrabold tracking-tighter text-[var(--text)]';

export const twStatCardHint = 'text-[0.78rem] text-[color:var(--text-muted)]';

export const twDashPanels = 'grid grid-cols-1 gap-4 lg:grid-cols-2';

export const twDashPanelHead =
  'mb-1 flex flex-wrap items-center justify-between gap-3';

export const twDashPanelEmpty = 'my-3 text-[0.9rem] text-[color:var(--text-muted)]';

export const twDashStatus =
  'text-[0.72rem] font-semibold capitalize text-[var(--accent)]';

export const twOrderHbarList = 'mt-3.5 flex flex-col gap-4';

export const twOrderHbarRow = 'grid gap-2';

export const twOrderHbarTop = 'flex items-baseline justify-between gap-3';

export const twOrderHbarTitle = 'text-[0.82rem] font-bold text-[var(--text)]';

export const twOrderHbarCount = 'shrink-0 text-[0.95rem] font-extrabold text-[var(--text)]';

export const twOrderHbarTrack =
  'h-3 overflow-hidden rounded-full border border-[color:var(--border)] bg-[rgba(15,23,42,0.65)]';

export const twOrderHbarFillPending =
  'h-full rounded-full bg-gradient-to-r from-amber-300/85 to-amber-500/95';

export const twOrderHbarFillDelivered =
  'h-full rounded-full bg-gradient-to-r from-emerald-400/85 to-emerald-600/95';

export const twOrderHbarFillCancelled =
  'h-full rounded-full bg-gradient-to-r from-red-400/75 to-red-600/92';

export const twCustomerCell = 'max-w-[220px] text-[0.88rem] leading-snug';

export const twCustomerCellName = 'font-semibold text-[var(--text)]';

export const twCustomerCellLine = 'mt-0.5 text-[0.82rem] text-[color:var(--text-muted)]';

export const twCustomerCellAddress = 'whitespace-pre-wrap break-words';

export const twOrdersLinesCell = 'flex min-w-0 flex-col gap-1';

export const twOrdersLinesCellCompact = `${twOrdersLinesCell} items-start gap-2`;

export const twOrdersLinesSummaryText = 'min-w-0 text-[0.84rem] leading-[1.35]';

export const twOrdersLinesSummaryInline =
  'inline-flex max-w-full flex-nowrap items-baseline gap-0 whitespace-nowrap';

export const twOrdersLinesCount = 'shrink-0 text-[color:var(--text-muted)]';

export const twOrdersLinesTotal =
  'shrink-0 font-bold tabular-nums text-[var(--text)]';

export const twOrdersLinesSummary = 'flex min-w-0 flex-wrap items-center gap-2 text-[0.82rem]';

export const twStatusSelect =
  'w-full max-w-[140px] min-w-[118px] cursor-pointer rounded-[length:var(--radius-sm)] border border-[color:var(--border)] bg-[rgba(15,23,42,0.65)] px-2.5 py-1.5 text-[0.85rem] text-[var(--text)] outline-none focus:shadow-[var(--ring)]';

export const twProfileSectionHead =
  'mb-2 flex flex-wrap items-center justify-between gap-3';

export const twProfileDl = 'm-0 flex flex-col gap-4';

export const twProfileDt =
  'm-0 mb-1 text-[0.72rem] font-bold uppercase tracking-wider text-[color:var(--text-faint)]';

export const twProfileDd = 'm-0 text-[0.95rem] text-[var(--text)]';

export const twProfilePasswordBlock =
  'mt-5 border-t border-[color:var(--border)] pt-5';

export const twFormFooter = 'mt-2 flex flex-wrap items-center justify-end gap-3';

export const twModalSectionLabel =
  'mb-0.5 text-[0.72rem] font-bold uppercase tracking-wider text-[color:var(--text-faint)]';

export const twModalFormOrder =
  'flex w-full min-w-0 flex-col gap-[22px] [&>.field+.field]:mt-3.5';

export const twOrderModalBlock = 'flex w-full min-w-0 flex-col gap-3';

export const twOrderModalLineGrid =
  'grid w-full grid-cols-2 items-end gap-x-3 gap-y-0 max-[399px]:grid-cols-1 [&_.field]:mb-0 [&_.field+.field]:mt-0';

export const twModalOrderRef =
  '-mt-2 mb-4 font-mono text-[0.85rem] text-[color:var(--text-muted)]';

export const twModalTotalPreview = 'm-0 mb-1 text-[0.9rem] text-[color:var(--text-muted)]';

export const twOrderDraftForm =
  'rounded-[length:var(--radius-md)] border border-[color:var(--border)] bg-black/20 px-3.5 py-3';

export const twOrderDraftRevampRow =
  'mt-3.5 grid grid-cols-1 items-start gap-x-5 gap-y-4 min-[520px]:grid-cols-[1fr_minmax(132px,168px)]';

export const twOrderDraftRevampColProduct = 'min-w-0';

export const twOrderDraftRevampColQty = 'min-w-0';

export const twOrderDraftRevampPlaceholder =
  'm-0 text-[0.84rem] leading-[1.4] text-[color:var(--text-muted)]';

export const twOrderDraftLineWeight = 'mt-2 text-[0.82rem] text-[color:var(--text-muted)]';

export const twOrderLineSubtotal =
  'm-0 mt-1 mb-0 text-[0.9rem] text-[color:var(--text-muted)]';

export const twOrderGrandTotal =
  'm-0 mt-1 mb-0 text-[0.9rem] text-[color:var(--text-muted)]';

export const twOrderFormSectionLabel =
  'm-0 mb-0.5 text-[0.72rem] font-bold uppercase tracking-wider text-[color:var(--text-faint)]';

export const twOrderLineProductName =
  'text-[0.9rem] font-semibold leading-snug text-[var(--text)] whitespace-nowrap';

export const twOrderLineProductMeta =
  'mt-1 flex flex-nowrap gap-x-2 text-[0.75rem] leading-snug text-[color:var(--text-muted)] whitespace-nowrap';

export const twOrderLineColNumeric =
  'min-w-[5.5rem] text-center align-middle tabular-nums whitespace-nowrap';

export const twOrderLineColProduct =
  'min-w-[10rem] align-top text-left text-[var(--text)] whitespace-nowrap';

export const twOrderLineTableQty =
  'mx-auto block w-full max-w-[5.5rem] rounded-[length:var(--radius-sm)] border border-[color:var(--border)] bg-[rgba(15,23,42,0.65)] px-2 py-1.5 text-center text-[0.84rem] text-[var(--text)] outline-none focus:border-sky-400/55 focus:shadow-[var(--ring)]';

export const twOrderAddedLinesPanel =
  'mt-4 min-w-0 overflow-hidden rounded-[length:var(--radius-md)] border border-[color:var(--border)] bg-black/15';

export const twOrderAddedLinesToggle =
  'flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-white/[0.04] px-3.5 py-3 text-left text-[0.88rem] font-semibold text-[var(--text)] transition hover:bg-white/[0.07]';

export const twOrderAddedLinesSum = 'font-medium text-[color:var(--text-muted)]';

export const twOrderLinesTableEmpty =
  'm-0 px-2 py-3 text-[0.88rem] text-[color:var(--text-muted)]';

export const twOrderLinesThIcon = 'text-[0.85rem] opacity-85';

export const twOrderChevron =
  'shrink-0 text-[1rem] text-[color:var(--text-muted)] transition-transform';

export const twOrderChevronOpen = 'rotate-180';

export const twOrderLinesTableWrap = 'order-lines-table-scroll';

export const twOrderLinesInnerTable =
  'w-max min-w-full border-collapse text-[0.84rem] [&_th]:border-b [&_th]:border-[color:var(--border)] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-[0.72rem] [&_th]:font-bold [&_th]:uppercase [&_th]:whitespace-nowrap [&_th]:text-[color:var(--text-faint)] [&_td]:border-b [&_td]:border-[color:var(--border)] [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-middle [&_tr:last-child_td]:border-b-0';

/** Wide enough to trigger horizontal scroll inside the order modal on narrow viewports */
export const twOrderLinesInnerTableCols5 = `${twOrderLinesInnerTable} min-w-[640px]`;

export const twOrderLineColActions =
  'min-w-[3rem] w-12 text-center align-middle whitespace-nowrap';

export const twProductComboboxWrap =
  'flex w-full overflow-hidden rounded-[length:var(--radius-sm)] border border-[color:var(--border)] bg-[rgba(15,23,42,0.65)] focus-within:border-sky-400/55 focus-within:shadow-[var(--ring)]';

export const twProductComboboxInput =
  'min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-[var(--text)] shadow-none outline-none ring-0';

export const twProductComboboxToggle =
  'grid size-[46px] shrink-0 place-items-center border-0 border-l border-[color:var(--border)] bg-white/[0.04] text-[color:var(--text-muted)] transition hover:bg-white/[0.08] hover:text-[var(--text)]';

export const twProductComboboxToggleOpen = 'text-[var(--accent)]';

export const twProductComboboxList =
  'absolute left-0 right-0 top-[calc(100%+6px)] z-10 m-0 max-h-60 list-none overflow-y-auto rounded-[length:var(--radius-sm)] border border-[color:var(--border)] bg-[linear-gradient(165deg,rgba(30,41,59,0.98)_0%,rgba(15,23,42,0.99)_100%)] p-1.5 shadow-[var(--shadow-lg)]';

export const twProductComboboxHint = 'px-3.5 py-3 text-[0.88rem] text-[color:var(--text-muted)]';

export const twProductComboboxItem =
  'flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-[var(--text)] transition hover:bg-white/[0.06]';

export const twProductComboboxItemActive =
  'bg-[var(--accent-dim)] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.25)]';

export const twProductComboboxItemName = 'text-[0.92rem] font-semibold text-[var(--text)]';

export const twProductComboboxItemMeta = 'text-[0.8rem] text-[color:var(--text-muted)]';

export const twFaComboboxChevron = 'text-[0.95rem] leading-none transition-transform duration-150';

export const twModalBackdropViewLines = twModalBackdrop.replace('z-[200]', 'z-[220]');

export const twModalViewLinesDialog =
  'max-h-[min(90vh,560px)] w-[min(560px,100%)] overflow-auto rounded-[length:var(--radius-lg)] border border-[color:var(--border)] bg-gradient-to-br from-slate-800/95 to-slate-900/98 px-6 py-5 shadow-[var(--shadow-lg)]';

export const twModalOrderEditDialog =
  'max-h-[min(94vh,720px)] min-h-0 w-[min(560px,100%)] overflow-y-auto overscroll-contain rounded-[length:var(--radius-lg)] border border-[color:var(--border)] bg-gradient-to-br from-slate-800/95 to-slate-900/98 px-6 py-5 shadow-[var(--shadow-lg)]';

export const twOrderViewLinesTableWrap =
  'order-lines-table-scroll mb-2 rounded-[length:var(--radius-sm)] border border-[color:var(--border)]';

export const twOrderViewLinesTable =
  `${twTable} m-0 min-w-[640px] w-max text-[0.86rem] [&_th]:px-3 [&_th]:py-2.5 [&_th]:whitespace-nowrap [&_td]:px-3 [&_td]:py-2.5 [&_td]:whitespace-nowrap [&_th]:text-[0.72rem] [&_td]:text-[0.84rem]`;

export const twOrderViewLinesMeta = 'mb-3 text-[0.88rem] text-[color:var(--text-muted)]';

export const twOrderViewLinesBtn = `${twBtnGhostSm} max-w-full self-stretch`;

export const twOrderViewLinesActions = 'mt-1';

export const twOrderViewColIdx = 'w-10 text-center';

export const twOrderAddLineWrap = 'mt-3.5';

export const twOrderAddLineBtn = `${twBtnPrimarySm} w-full sm:w-auto`;

export const twOrderDeliveryField = 'mt-4';

export const twOrdersTableWrap = 'mt-2 overflow-x-auto';

export const twOrdersDataTable = `${twTableCompact} min-w-[1080px] w-max table-auto`;

export const twOrdersColOrder = 'w-[1%] whitespace-nowrap align-top';

export const twOrdersColTracking =
  'min-w-[120px] max-w-[220px] whitespace-nowrap align-top text-[0.82rem]';

export const twOrdersColLines = 'min-w-[120px] max-w-[200px] align-top';

export const twOrdersColCustomer = 'min-w-[160px] max-w-[240px] align-top';

export const twOrdersColCreated = 'w-[1%] whitespace-nowrap align-top';

export const twOrdersColNote =
  'min-w-[100px] max-w-[180px] align-top text-[0.82rem] text-[color:var(--text-muted)] [overflow-wrap:anywhere]';

export const twOrdersColStatus =
  'w-[1%] min-w-[132px] whitespace-nowrap align-top';

export const twOrdersColActions =
  'w-[1%] min-w-[158px] whitespace-nowrap align-top text-right';

export const twDashboardHome = 'flex flex-col gap-5';

export const twDashboardHomeToolbar = 'flex flex-wrap items-center justify-between gap-3';

export const twTableRefreshBtn = `${twBtnGhostSm} min-w-[2.25rem] px-2`;
