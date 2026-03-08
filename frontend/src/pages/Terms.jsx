import { useNavigate } from "react-router-dom";

export default function Terms() {
    const navigate = useNavigate();
  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "auto" }}>
      
      <h1>Terms of Service</h1>
      <p>Last Updated: March 6, 2026</p>

      <p>
        Welcome to our platform. By accessing or using this service, you agree
        to be bound by these Terms of Service.
      </p>

      <h2>1. Use of the Service</h2>
      <p>
        You agree to use the platform only for lawful purposes. You may not use
        the service to upload, distribute, or transmit content that is illegal,
        harmful, fraudulent, or violates the rights of others.
      </p>

      <h2>2. User Responsibility</h2>
      <p>
        Users are solely responsible for any files, URLs, or other content they
        upload or submit through the platform.
      </p>
      <p>
        By uploading content, you represent and warrant that you have the legal
        right to distribute or use that content.
      </p>

      <h2>3. Copyright Responsibility</h2>
      <p>
        This platform does not claim ownership of any uploaded content. Users
        are responsible for ensuring they have the proper rights to upload and
        use any content.
      </p>

      <h2>4. Limitation of Liability</h2>
      <p>
        The service is provided "as is" without warranties of any kind. We are
        not responsible for any damages resulting from the use of the platform.
      </p>

      <h2>5. Account Termination</h2>
      <p>
        We reserve the right to suspend or terminate accounts that violate
        these terms.
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