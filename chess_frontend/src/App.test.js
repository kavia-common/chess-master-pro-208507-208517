import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the app brand title", () => {
  render(<App />);
  const title = screen.getByText(/Neon Violet Chess/i);
  expect(title).toBeInTheDocument();
});
