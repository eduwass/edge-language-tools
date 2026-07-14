export interface PreviewExample {
  title?: string
  source: string
  minHeight?: number
}

export const previews: Record<string, PreviewExample[]> = {
  accordion: [
    {
      source: `@accordion()
  <details open>
    <summary>
      Is it accessible?
      @svg('lucide:chevron-down')
    </summary>
    <section>Yes. It uses native disclosure semantics.</section>
  </details>
  <details>
    <summary>
      Is it styled?
      @svg('lucide:chevron-down')
    </summary>
    <section>Yes. It comes with basecoat styles.</section>
  </details>
@end`,
    },
  ],
  alert: [
    {
      source: `@alert({ variant: 'default', title: 'Heads up', description: 'You can add components to your app.' })
@end`,
    },
  ],
  avatar: [
    {
      source: `@avatar({ src: 'https://github.com/shadcn.png', alt: 'User' })
@end`,
    },
    {
      title: 'Fallback',
      source: `@avatar({ fallback: 'CN' })
@end`,
    },
  ],
  badge: [
    {
      source: `@badge({ variant: 'secondary' })
  New
@end`,
    },
  ],
  breadcrumb: [
    {
      source: `@breadcrumb()
  <li><a href="#">Home</a></li>
  <li><a href="#">Components</a></li>
  <li aria-current="page">Breadcrumb</li>
@end`,
    },
  ],
  button: [
    {
      title: 'Variants',
      source: `@button({ variant: 'primary' })
  Primary
@end
@button({ variant: 'outline', size: 'sm' })
  Outline small
@end
@button({ variant: 'ghost' })
  Ghost
@end`,
    },
  ],
  button_group: [
    {
      source: `@buttonGroup()
  @button({ variant: 'outline' })
    Left
  @end
  @button({ variant: 'outline' })
    Center
  @end
  @button({ variant: 'outline' })
    Right
  @end
@end`,
    },
  ],
  card: [
    {
      source: `@card()
  @slot('header')
    <h2>Card title</h2>
    <p>Card description</p>
  @end
  @slot('section')
    <p>Card content goes here.</p>
  @end
  @slot('footer')
    @button({ variant: 'outline' })
      Action
    @end
  @end
@end`,
      minHeight: 220,
    },
  ],
  chart: [
    {
      source: `@chart({ type: 'bar' })
  <div style="display: flex; align-items: flex-end; gap: 0.5rem; height: 10rem; padding: 1rem;">
    <div style="flex: 1; height: 40%; background: var(--primary, #333); border-radius: 4px;"></div>
    <div style="flex: 1; height: 70%; background: var(--primary, #333); border-radius: 4px;"></div>
    <div style="flex: 1; height: 55%; background: var(--primary, #333); border-radius: 4px;"></div>
    <div style="flex: 1; height: 85%; background: var(--primary, #333); border-radius: 4px;"></div>
  </div>
@end`,
      minHeight: 200,
    },
  ],
  checkbox: [
    {
      source: `@checkbox({ name: 'terms', label: 'Accept terms' })
@end`,
    },
  ],
  collapsible: [
    {
      source: `@collapsible({ open: true })
  <summary>Can I use this in my project?</summary>
  <section>Yes. It uses native details and summary elements.</section>
@end`,
    },
  ],
  combobox: [
    {
      source: `@combobox({ id: 'preview-combobox', placeholder: 'Select framework...' })
  <div role="option" data-value="react">React</div>
  <div role="option" data-value="vue">Vue</div>
  <div role="option" data-value="svelte">Svelte</div>
@end`,
      minHeight: 180,
    },
  ],
  command: [
    {
      source: `@command({
  id: 'preview-command',
  items: [
    { label: 'Calendar', type: 'item' },
    { label: 'Search', type: 'item' },
    { type: 'separator' },
    { label: 'Settings', type: 'item' },
  ],
})
@end`,
      minHeight: 240,
    },
  ],
  dialog: [
    {
      source: `@dialog({
  id: 'preview-dialog',
  trigger: 'Open dialog',
  title: 'Edit profile',
  description: 'Make changes to your profile here.',
})
  @slot('main')
    <p>Dialog body content.</p>
  @end
  @slot('footer')
    @button({ variant: 'outline' })
      Cancel
    @end
    @button()
      Save
    @end
  @end
@end`,
      minHeight: 280,
    },
  ],
  dropdown_menu: [
    {
      source: `@dropdownMenu({
  id: 'preview-dropdown',
  items: [
    { label: 'Profile', type: 'item' },
    { label: 'Settings', type: 'item' },
    { type: 'separator' },
    { label: 'Logout', type: 'item' },
  ],
})
  @slot('trigger')
    Open menu
  @end
@end`,
      minHeight: 180,
    },
  ],
  empty: [
    {
      source: `@empty({ title: 'No results', description: 'Try adjusting your search or filters.' })
@end`,
      minHeight: 180,
    },
  ],
  field: [
    {
      source: `@field({ label: 'Email', description: 'We will never share your email.' })
  @input({ type: 'email', name: 'email', placeholder: 'you@example.com' })
  @end
@end`,
    },
  ],
  form: [
    {
      source: `@form({ action: '/submit', method: 'post' })
  @field({ label: 'Name' })
    @input({ name: 'name', placeholder: 'Your name' })
    @end
  @end
  @button({ type: 'submit' })
    Submit
  @end
@end`,
      minHeight: 200,
    },
  ],
  input: [
    {
      source: `@input({ type: 'email', name: 'email', placeholder: 'you@example.com' })
@end`,
    },
  ],
  input_group: [
    {
      source: `@inputGroup()
  @input({ placeholder: 'Search...' })
  @end
  <span role="group" data-align="inline-end">
    @button({ variant: 'outline', size: 'sm' })
      Search
    @end
  </span>
@end`,
    },
  ],
  item: [
    {
      source: `@item({ title: 'Notifications', description: 'You have 3 unread messages.' })
@end`,
    },
  ],
  kbd: [
    {
      source: `@kbd()
  Ctrl
@end
@kbd()
  K
@end`,
    },
  ],
  label: [
    {
      source: `@label({ htmlFor: 'preview-email' })
  Email address
@end`,
    },
  ],
  native_select: [
    {
      source: `@nativeSelect({ name: 'fruit' })
  <option value="">Select a fruit</option>
  <option value="apple">Apple</option>
  <option value="banana">Banana</option>
  <option value="orange">Orange</option>
@end`,
    },
  ],
  popover: [
    {
      source: `@popover({ id: 'preview-popover' })
  @slot('trigger')
    Open popover
  @end
  @slot('main')
    <p style="padding: 0.5rem;">Popover content goes here.</p>
  @end
@end`,
      minHeight: 180,
    },
  ],
  progress: [
    {
      source: `@progress({ value: 60, max: 100 })
@end`,
    },
  ],
  radio: [
    {
      source: `@radio({ name: 'plan', value: 'free', label: 'Free', checked: true })
@end
@radio({ name: 'plan', value: 'pro', label: 'Pro' })
@end`,
    },
  ],
  scrollbar: [
    {
      source: `@scrollbar()
  <div style="max-height: 8rem; overflow: auto;">
    <p>Scrollable content line 1</p>
    <p>Scrollable content line 2</p>
    <p>Scrollable content line 3</p>
    <p>Scrollable content line 4</p>
    <p>Scrollable content line 5</p>
    <p>Scrollable content line 6</p>
    <p>Scrollable content line 7</p>
    <p>Scrollable content line 8</p>
  </div>
@end`,
      minHeight: 180,
    },
  ],
  select: [
    {
      source: `@select({
  id: 'preview-select',
  placeholder: 'Select a fruit',
  items: [
    { label: 'Apple', value: 'apple', type: 'item' },
    { label: 'Banana', value: 'banana', type: 'item' },
    { label: 'Orange', value: 'orange', type: 'item' },
  ],
})
@end`,
      minHeight: 180,
    },
  ],
  sidebar: [
    {
      source: `@sidebar({
  id: 'preview-sidebar',
  menu: [
    { type: 'item', label: 'Dashboard', url: '#', current: true },
    { type: 'item', label: 'Projects', url: '#' },
    { type: 'separator' },
    { type: 'item', label: 'Settings', url: '#' },
    { type: 'item', label: 'Help', url: '#' },
  ],
})
@end`,
      minHeight: 320,
    },
  ],
  skeleton: [
    {
      source: `@skeleton()
  <div style="height: 2rem; width: 12rem;"></div>
@end`,
    },
  ],
  switch: [
    {
      source: `@switch({ name: 'notifications', label: 'Enable notifications' })
@end`,
    },
  ],
  table: [
    {
      source: `@table()
  <thead>
    <tr><th>Name</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Ada Lovelace</td><td>Active</td></tr>
    <tr><td>Alan Turing</td><td>Active</td></tr>
  </tbody>
@end`,
      minHeight: 200,
    },
  ],
  tabs: [
    {
      source: `@tabs({
  id: 'preview-tabs',
  tabsets: [
    { tab: 'Account', panel: '<p>Account settings</p>' },
    { tab: 'Password', panel: '<p>Change your password</p>' },
    { tab: 'Team', panel: '<p>Manage your team</p>' },
  ],
})
@end`,
      minHeight: 200,
    },
  ],
  textarea: [
    {
      source: `@textarea({ name: 'message', placeholder: 'Type your message here.', rows: 4 })
@end`,
      minHeight: 180,
    },
  ],
  toast: [
    {
      source: `@toast({
  toasts: [
    { category: 'success', title: 'Saved', description: 'Your changes have been saved.' },
  ],
})
@end`,
      minHeight: 180,
    },
  ],
  tooltip: [
    {
      source: `@tooltip({ id: 'preview-tooltip' })
  @slot('trigger')
    Hover me
  @end
  Helpful tooltip text
@end`,
      minHeight: 180,
    },
  ],
}
