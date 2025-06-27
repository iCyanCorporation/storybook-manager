import React from "react";

interface MyComponentProps {
  name: string;
}

const MyComponent: React.FC<MyComponentProps> = ({ name }) => {
  return (
    <div>
      <h1>Hello, {name}!</h1>
      <p>This is a dummy component for testing storybook-manager.</p>
    </div>
  );
};

export default MyComponent;
