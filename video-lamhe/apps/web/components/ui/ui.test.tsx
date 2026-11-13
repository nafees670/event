import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { describe, expect, it, vi } from 'vitest';
import { Button, Chip, Input, Modal, Select, ThemeToggle } from './index';

describe('Button', () => {
  it('defaults to type=button and handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Book</Button>);
    const btn = screen.getByRole('button', { name: 'Book' });
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and busy while loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/drones">Drones</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Drones' })).toHaveAttribute('href', '/drones');
  });
});

describe('Chip', () => {
  it('exposes selected state via aria-pressed', () => {
    render(<Chip selected>Barat</Chip>);
    expect(screen.getByRole('button', { name: 'Barat' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Input & Select', () => {
  it('associates label and error', () => {
    render(<Input label="Email" error="Required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Required');
  });

  it('renders select options with a placeholder', () => {
    render(
      <Select
        label="City"
        placeholder="Pick"
        options={[{ value: 'karachi', label: 'Karachi' }]}
        defaultValue=""
      />,
    );
    expect(screen.getByLabelText('City')).toHaveDisplayValue('Pick');
    expect(screen.getByRole('option', { name: 'Karachi' })).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('opens from the trigger and closes with the close button', async () => {
    render(<Modal trigger={<Button>Open</Button>} title="Hello" description="World" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Hello' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ThemeToggle', () => {
  it('switches theme and reports the choice', async () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <ThemeToggle onChange={onChange} />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Change theme' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
});
