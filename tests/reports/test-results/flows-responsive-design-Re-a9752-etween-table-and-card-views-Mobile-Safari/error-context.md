# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: Sign in
        - generic [ref=e6]: Enter your email and password to access your account
      - generic [ref=e7]:
        - form "Sign in" [ref=e8]:
          - generic [ref=e9]:
            - text: Email
            - textbox "Email" [ref=e10]:
              - /placeholder: Enter your email
          - generic [ref=e11]:
            - text: Password
            - textbox "Password" [ref=e12]:
              - /placeholder: Enter your password
          - button "Sign in" [ref=e13] [cursor=pointer]
        - generic [ref=e14]:
          - text: Don't have an account?
          - link "Sign up" [ref=e15]:
            - /url: /register
  - alert [ref=e16]
```