import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A flexible input component with consistent styling and focus states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'tel', 'url'],
    },
    placeholder: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
    required: {
      control: 'boolean',
    },
  },
  args: {
    placeholder: 'Enter value...',
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic text input
export const Default: Story = {
  args: {
    type: 'text',
    placeholder: 'Enter your name',
  },
};

// Different input types
export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter email address',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    placeholder: 'Enter quantity',
    min: 0,
    max: 100,
  },
};

// States
export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled input',
    value: 'Cannot edit this',
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="team-name">Team Name</Label>
      <Input
        id="team-name"
        type="text"
        placeholder="Enter your team name"
      />
    </div>
  ),
};

// Game-specific inputs
export const PriceInput: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="price">Retail Price (€)</Label>
      <Input
        id="price"
        type="number"
        placeholder="199"
        min="50"
        max="500"
      />
    </div>
  ),
};

export const BudgetInput: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="budget">Team Budget (€)</Label>
      <Input
        id="budget"
        type="number"
        placeholder="20000"
        min="10000"
        max="50000"
      />
    </div>
  ),
};
