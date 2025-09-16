import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A flexible card component with header, content, and footer sections.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic card
export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the main content of the card.</p>
      </CardContent>
    </Card>
  ),
};

// Card with footer
export const WithFooter: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Team Dashboard</CardTitle>
        <CardDescription>Monitor your team's performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Revenue:</span>
            <span className="font-semibold">€2,450</span>
          </div>
          <div className="flex justify-between">
            <span>Profit:</span>
            <span className="font-semibold text-green-600">€890</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">View Details</Button>
      </CardFooter>
    </Card>
  ),
};

// Compact card
export const Compact: Story = {
  render: () => (
    <Card className="w-64">
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">€1,250</div>
          <p className="text-sm text-gray-600">Current Budget</p>
        </div>
      </CardContent>
    </Card>
  ),
};

// Game status card
export const GameStatus: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          Phase 1: Pre-Purchase
        </CardTitle>
        <CardDescription>Time remaining: 8:45</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span>Fix Seats Available:</span>
            <span className="font-semibold">450</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Your Allocation:</span>
            <span className="font-semibold text-blue-600">120</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex gap-2 w-full">
          <Button variant="outline" size="sm">Refresh</Button>
          <Button size="sm">Purchase Seats</Button>
        </div>
      </CardFooter>
    </Card>
  ),
};
