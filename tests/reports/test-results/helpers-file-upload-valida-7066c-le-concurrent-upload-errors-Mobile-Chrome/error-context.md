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
              - text: carlosfront@gmail.com
          - generic [ref=e11]:
            - text: Password
            - textbox "Password" [ref=e12]:
              - /placeholder: Enter your password
              - text: senha123
          - alert [ref=e14]: Too many failed attempts. Please wait 28 seconds before trying again.
          - button "Sign in" [ref=e15] [cursor=pointer]
        - generic [ref=e16]:
          - text: Don't have an account?
          - link "Sign up" [ref=e17] [cursor=pointer]:
            - /url: /register
  - generic [ref=e18]:
    - img [ref=e20]
    - button "Open Tanstack query devtools" [ref=e68] [cursor=pointer]:
      - img [ref=e69]
  - alert [ref=e117]
```