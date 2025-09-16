# Storybook Documentation

This directory contains Storybook stories for developing and testing UI components in isolation.

## Getting Started

```bash
# Start Storybook
npm run storybook

# Build Storybook for production
npm run build-storybook
```

Storybook will be available at `http://localhost:6006`.

## Available Stories

### UI Components

#### Button (`Button.stories.tsx`)
- **Default**: Standard button with primary styling
- **Destructive**: Red button for dangerous actions
- **Outline**: Bordered button with transparent background
- **Secondary**: Muted button for secondary actions
- **Ghost**: Minimal button with hover effects
- **Link**: Button styled as a link
- **Sizes**: Small, default, large, and icon variants
- **States**: Normal, disabled, and loading states

#### Card (`Card.stories.tsx`)
- **Default**: Basic card with header, content
- **WithFooter**: Card including footer with actions
- **Compact**: Minimal card for displaying metrics
- **GameStatus**: Card showing game phase and status

#### Input (`Input.stories.tsx`)
- **Default**: Standard text input
- **Email/Password/Number**: Different input types
- **Disabled**: Non-interactive input state
- **WithLabel**: Input with associated label
- **PriceInput**: Number input for prices
- **BudgetInput**: Number input for budgets

## Writing Stories

### Basic Story Structure

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MyComponent } from '../components/MyComponent';

const meta = {
  title: 'UI/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Component props
  },
};
```

### Story with Render Function

For more complex scenarios:

```tsx
export const ComplexExample: Story = {
  render: () => (
    <div className="space-y-4">
      <MyComponent prop1="value1" />
      <MyComponent prop1="value2" />
    </div>
  ),
};
```

## Best Practices

1. **Organize by Component**: Group stories by component type (UI, Forms, Game, etc.)
2. **Use Realistic Data**: Use realistic props and data that match production usage
3. **Test Edge Cases**: Include stories for error states, loading states, and edge cases
4. **Document Props**: Use `argTypes` to document component props
5. **Responsive Testing**: Test components at different screen sizes

## Integration with Testing

Stories can be used for:
- **Visual Regression Testing**: Compare screenshots of components
- **Component Testing**: Test component behavior with Vitest
- **Accessibility Testing**: Automated a11y checks
- **Documentation**: Auto-generated component documentation

## Adding New Stories

1. Create a new `.stories.tsx` file in this directory
2. Import the component and required dependencies
3. Define the meta object with title, component, and parameters
4. Export individual stories as named exports
5. Run `npm run storybook` to see your stories

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Writing Stories](https://storybook.js.org/docs/writing-stories)
- [Args and Controls](https://storybook.js.org/docs/essentials/controls)
