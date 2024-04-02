import type { Meta, StoryObj } from '@storybook/react';


import { Membership } from './Membership';

const meta = {
  title: 'Example/Membership',
  component: Membership,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Membership>;

export default meta;
type Story = StoryObj<typeof meta>;

export const cardprice: Story = {};


