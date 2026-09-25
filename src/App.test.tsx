import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App.tsx';

test('shows the game title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('You Skipped The OP?!');
});
