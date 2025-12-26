# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: Create account
        - generic [ref=e6]: Enter your information to create a new account
      - generic [ref=e7]:
        - form "Create account" [ref=e8]:
          - generic [ref=e9]:
            - text: Full Name
            - textbox "Full Name" [ref=e10]:
              - /placeholder: Enter your full name
          - generic [ref=e11]:
            - text: Email
            - textbox "Email" [ref=e12]:
              - /placeholder: Enter your email
          - generic [ref=e13]:
            - text: Password
            - textbox "Password" [ref=e14]:
              - /placeholder: Enter your password
          - generic [ref=e15]:
            - text: Confirm Password
            - textbox "Confirm Password" [ref=e16]:
              - /placeholder: Confirm your password
          - button "Create account" [ref=e17] [cursor=pointer]
        - generic [ref=e18]:
          - text: Already have an account?
          - link "Sign in" [ref=e19] [cursor=pointer]:
            - /url: /login
  - generic [ref=e20]:
    - img [ref=e22]
    - button "Open Tanstack query devtools" [ref=e70] [cursor=pointer]:
      - img [ref=e71]
  - alert [ref=e119]
```