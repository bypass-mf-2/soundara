import { useNavigate } from "react-router-dom";

export default function DMCA() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "auto", lineHeight: "1.6" }}>

      <h1>DMCA Copyright Policy</h1>
      <p>Last Updated: March 6, 2026</p>

      <p>
        We respect the intellectual property rights of others and expect users
        of the platform to do the same.
      </p>

      <h2>1. User Responsibility</h2>
      <p>
        Users are solely responsible for the content they upload, submit, or
        process using the platform. By uploading content, users represent and
        warrant that they have the necessary rights or permissions to use that
        content.
      </p>

      <h2>2. No Ownership Claim</h2>
      <p>
        This platform does not claim ownership over any user-uploaded content.
        Content is processed solely at the direction of the user.
      </p>

      <h2>3. Copyright Infringement Notification</h2>
      <p>
        If you believe that copyrighted material has been uploaded or processed
        on this platform without authorization, you may submit a DMCA takedown
        request.
      </p>

      <p>Your notice should include:</p>

      <ul>
        <li>A description of the copyrighted work being infringed</li>
        <li>The location of the infringing material on the platform</li>
        <li>Your contact information</li>
        <li>A statement that you have a good-faith belief the use is unauthorized</li>
        <li>A statement that the information provided is accurate</li>
      </ul>

      <h2>4. Removal of Content</h2>
      <p>
        Upon receiving a valid DMCA notice, we may remove or disable access to
        the allegedly infringing content.
      </p>

      <h2>5. Repeat Infringers</h2>
      <p>
        Accounts that repeatedly violate copyright policies may be suspended or
        permanently removed.
      </p>

      <h2>6. Contact</h2>
      <p>
        DMCA requests can be submitted to the platform administrator through the
        contact method provided on the website.
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