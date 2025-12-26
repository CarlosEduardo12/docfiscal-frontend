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
            - textbox "Email" [disabled] [ref=e10]:
              - /placeholder: Enter your email
              - text: test@docfiscal.com
          - generic [ref=e11]:
            - text: Password
            - textbox "Password" [disabled] [ref=e12]:
              - /placeholder: Enter your password
              - text: testpassword123
          - button "Signing in..." [disabled]
        - generic [ref=e13]:
          - text: Don't have an account?
          - link "Sign up" [ref=e14] [cursor=pointer]:
            - /url: /register
  - generic [ref=e15]:
    - img [ref=e17]
    - button "Open Tanstack query devtools" [ref=e66] [cursor=pointer]:
      - img [ref=e67]
  - alert [ref=e116]
```