# CLAUDE.md - AI Assistant Guide for ClawdConsole

This document provides guidance for AI assistants working with the ClawdConsole repository.

## Project Overview

**Repository**: ClawdConsole
**Status**: Initial development phase
**Purpose**: Console application project (to be defined as development progresses)

## Repository Structure

```
ClawdConsole/
├── README.md           # Project description and documentation
├── CLAUDE.md           # This file - AI assistant guidelines
└── (additional structure to be added)
```

### Current State

This repository is in its initial setup phase. The project structure will evolve as development progresses.

## Development Guidelines

### General Principles

1. **Keep it simple** - Avoid over-engineering; implement only what's needed
2. **Be explicit** - Favor clarity over cleverness in code
3. **Document as you go** - Update this file when adding significant features or conventions

### Code Style

- Follow language-specific best practices for whichever language is chosen
- Use meaningful variable and function names
- Keep functions focused and single-purpose
- Write self-documenting code; add comments only when logic isn't self-evident

### Git Workflow

- **Main branch**: Protected; contains stable, reviewed code
- **Feature branches**: Use descriptive names (e.g., `feature/add-user-auth`, `fix/memory-leak`)
- **Commit messages**: Write clear, concise messages describing what and why
  - Use imperative mood: "Add feature" not "Added feature"
  - Keep first line under 50 characters
  - Add body for complex changes

### Commit Message Format

```
<type>: <short description>

<optional body explaining why and context>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## For AI Assistants

### Before Making Changes

1. **Read first** - Always read files before modifying them
2. **Understand context** - Explore related files to understand how code fits together
3. **Check dependencies** - Understand what might be affected by changes

### When Implementing Features

1. Start by understanding existing patterns in the codebase
2. Follow established conventions and coding styles
3. Make minimal, focused changes that address the specific request
4. Don't add features, refactoring, or "improvements" beyond what was asked
5. Avoid introducing security vulnerabilities (command injection, XSS, SQL injection, etc.)

### Testing

- Write tests for new functionality when a testing framework is set up
- Run existing tests before committing to ensure no regressions
- Fix any tests broken by your changes

### Documentation

- Update README.md for user-facing changes
- Update this CLAUDE.md when adding new conventions or significant structural changes
- Don't create unnecessary documentation files

## Configuration Files

*This section will be populated as configuration files are added to the project.*

## Build & Development

*Build instructions and development setup will be added as the project develops.*

### Prerequisites

- (To be defined based on chosen technology stack)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd ClawdConsole

# Additional setup steps to be added
```

### Running the Project

```bash
# Commands to be added when project structure is established
```

### Running Tests

```bash
# Test commands to be added when testing framework is set up
```

## Key Components

*This section will document key modules and components as they are developed.*

## Common Tasks

### Adding a New Feature

1. Create a feature branch from main
2. Implement the feature following existing patterns
3. Add tests if applicable
4. Update documentation if needed
5. Submit for review

### Fixing a Bug

1. Reproduce the bug and understand the root cause
2. Create a fix branch
3. Implement the minimal fix needed
4. Add a test to prevent regression
5. Submit for review

## Dependencies

*Dependencies will be listed here as they are added to the project.*

## Environment Variables

*Environment variables and configuration will be documented here as needed.*

## Troubleshooting

*Common issues and solutions will be documented here as they arise.*

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-04 | Initial CLAUDE.md created | AI Assistant |

---

*This document should be updated as the project evolves. When adding new conventions, patterns, or significant structural changes, please update the relevant sections.*
