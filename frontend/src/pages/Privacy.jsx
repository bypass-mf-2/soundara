import { useNavigate } from "react-router-dom";

export default function Privacy() {
    const navigate = useNavigate();

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "auto", lineHeight: "1.6" }}>

      <h1>Privacy Policy</h1>
      <p>Last Updated: March 6, 2026</p>

      <p>
        Your privacy is important to us. This Privacy Policy explains how we
        collect, use, and protect your information when you use our platform.
      </p>

      <h2>1. Information We Collect</h2>
      <p>We may collect the following types of information:</p>

      <ul>
        <li>Google account identification information used for login</li>
        <li>Email address associated with your Google account</li>
        <li>Audio files or URLs you upload to the platform</li>
        <li>Usage data such as track purchases and subscriptions</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use collected information to:</p>

      <ul>
        <li>Provide and operate the service</li>
        <li>Process purchases and subscriptions</li>
        <li>Maintain your user library</li>
        <li>Improve the performance and reliability of the platform</li>
      </ul>

      <h2>3. Payment Processing</h2>
      <p>
        Payments are processed through a third-party provider. We do not store
        credit card numbers or payment details on our servers.
      </p>

      <p>
        Payment processing services are provided by{" "}
        <strong>Stripe</strong>.
      </p>

      <h2>4. Data Security</h2>
      <p>
        We implement reasonable technical and organizational measures to protect
        your information. However, no online platform can guarantee absolute
        security.
      </p>

      <h2>5. User Content</h2>
      <p>
        Files uploaded by users are stored for the purpose of providing the
        service. Users are responsible for ensuring they have the legal right to
        upload the content.
      </p>

      <h2>6. Third-Party Services</h2>
      <p>
        Our platform may rely on third-party services such as authentication
        providers and payment processors. These services have their own privacy
        policies governing the use of your information.
      </p>

      <h2>7. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy periodically. Continued use of the
        platform after updates constitutes acceptance of the revised policy.
      </p>

    <button
        onClick={() => {
          sessionStorage.setItem("showTosPopup", "true");
          navigate("/");
        }}
    >
        Back
    </button>

    </div>
  );
}