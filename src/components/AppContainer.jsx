import "./AppContainer.css";

function AppContainer({ children }) {
  return (
    <main className="app">
      {children}
    </main>
  );
}

export default AppContainer;