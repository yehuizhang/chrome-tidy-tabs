# Task Generation & Implementation Order Guidelines

## Implementation Priority Order

When generating tasks for feature development or bug fixes, follow this systematic approach to ensure stable, testable code:

### 1. Foundation First - Core Components
- **Helper Functions**: Utility functions, data transformers, validators
- **Type Definitions**: Interfaces, enums, and type aliases
- **Constants**: Configuration values, storage keys, default settings
- **Data Models**: Core data structures and their validation logic

### 2. Business Logic - Core Classes
- **Service Classes**: Core business logic without UI dependencies
- **Manager Classes**: Data management, state management, coordination logic
- **Storage Operations**: Data persistence and retrieval logic
- **Algorithm Implementation**: Search, sorting, ranking algorithms

### 3. Integration Layer - System Connections
- **Chrome API Integration**: Background scripts, permission handling
- **Storage Integration**: Connect business logic to persistence layer
- **Error Handling**: Centralized error management and recovery
- **Event Handling**: System events, lifecycle management

### 4. User Interface - Last Priority
- **UI Components**: Visual elements, rendering logic
- **User Interactions**: Click handlers, keyboard navigation
- **UI State Management**: Selection, display states
- **Styling**: CSS updates, visual improvements

### 5. Testing Strategy
- **Unit Tests**: Test individual components as they're built
- **Integration Tests**: Only after all components are implemented
- **End-to-End Tests**: Final validation of complete workflows

## Task Generation Best Practices

### Break Down Complex Features
- Start with the smallest, most fundamental pieces
- Each task should have clear, testable outcomes
- Avoid tasks that span multiple architectural layers

### Dependencies Management
- Identify and implement dependencies first
- Ensure each component can be tested in isolation
- Use dependency injection patterns for testability

### Incremental Development
- Build and test each layer before moving to the next
- Validate core functionality before adding UI polish
- Maintain working state at each step

### Example Task Sequence

For a new search feature:

1. **Foundation**: Define search result interfaces, create utility functions for URL normalization
2. **Core Logic**: Implement search algorithm, scoring logic, result ranking
3. **Integration**: Connect to storage, add Chrome API calls, error handling
4. **UI**: Update search interface, add keyboard navigation, visual feedback
5. **Testing**: Integration tests for complete search workflow

## Anti-Patterns to Avoid

- **UI-First Development**: Don't start with visual changes before logic is solid
- **Big Bang Integration**: Don't wait until everything is built to test integration
- **Premature Optimization**: Focus on correctness before performance
- **Skipping Foundation**: Don't jump to complex features without proper groundwork

## Quality Gates

Each implementation phase should meet these criteria before proceeding:

- **Foundation**: All types compile, utilities have unit tests
- **Core Logic**: Business logic works correctly in isolation
- **Integration**: System components communicate properly
- **UI**: User interface reflects underlying state accurately
- **Testing**: Integration tests validate complete user workflows

This approach ensures stable, maintainable code with clear separation of concerns and comprehensive test coverage.

## Core Design Principles

Follow these fundamental design principles throughout all development tasks:

### General Principles

- **DRY (Don't Repeat Yourself)**: Avoid duplicating code or logic; abstract and reuse instead
- **KISS (Keep It Simple, Stupid)**: Favor simplicity over unnecessary complexity
- **YAGNI (You Aren't Gonna Need It)**: Don't implement features until they're actually needed
- **SOC (Separation of Concerns)**: Keep different aspects of a system (UI, business logic, data) separate

### SOLID Principles

- **SRP (Single Responsibility Principle)**: A class/module should have only one reason to change
- **OCP (Open/Closed Principle)**: Software should be open for extension, but closed for modification
- **LSP (Liskov Substitution Principle)**: Subtypes should be substitutable for their base types
- **ISP (Interface Segregation Principle)**: Prefer many specific interfaces over a large, general one
- **DIP (Dependency Inversion Principle)**: Depend on abstractions, not concrete implementations

### Practical Application

#### DRY Implementation
- Extract common functionality into utility functions
- Use TypeScript generics for reusable components
- Create shared interfaces and types
- Centralize configuration and constants

#### KISS in Practice
- Prefer readable code over clever optimizations
- Use clear, descriptive naming
- Avoid deep nesting and complex conditionals
- Break down complex functions into smaller, focused ones

#### YAGNI Guidelines
- Implement only current requirements
- Resist adding "future-proof" features
- Focus on solving the immediate problem well
- Refactor when new requirements actually emerge

#### SOC Examples
- Separate data models from UI components
- Keep Chrome API calls isolated from business logic
- Maintain distinct layers for storage, processing, and presentation
- Use dependency injection to decouple components

#### SOLID in TypeScript
```typescript
// SRP: Each class has one responsibility
class SearchScorer { /* scoring logic only */ }
class SearchRenderer { /* rendering logic only */ }

// OCP: Extend behavior without modifying existing code
interface ISearchProvider {
  search(query: string): Promise<ISearchResult[]>;
}

// ISP: Specific interfaces
interface IStorageReader {
  read(key: string): Promise<any>;
}
interface IStorageWriter {
  write(key: string, value: any): Promise<void>;
}

// DIP: Depend on abstractions
class SearchEngine {
  constructor(private provider: ISearchProvider) {}
}
```

### Code Quality Checklist

Before completing any task, verify:
- [ ] No code duplication (DRY)
- [ ] Simple, readable implementation (KISS)
- [ ] Only required features implemented (YAGNI)
- [ ] Clear separation of concerns (SOC)
- [ ] Single responsibility per class/function (SRP)
- [ ] Extensible without modification (OCP)
- [ ] Proper interface segregation (ISP)
- [ ] Dependencies on abstractions (DIP)