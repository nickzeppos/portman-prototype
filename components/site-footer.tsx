import { Jost } from 'next/font/google';

const jost = Jost({ subsets: ['latin'], weight: ['500', '600', '700'] });

export function SiteFooter() {
  return (
    <footer className="mt-12">
      <div className="border-t border-gray-200 bg-white py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 text-sm sm:grid-cols-3">
          <div>
            <div
              className={`${jost.className} text-base font-bold uppercase leading-tight tracking-wider text-brand`}
            >
              University of Cincinnati
            </div>
            <div
              className={`${jost.className} mt-1 text-sm font-bold uppercase leading-tight tracking-wider`}
            >
              <span className="text-brand">Portman Center</span>{' '}
              <span className="text-gray-800">for Policy Solutions</span>
            </div>
          </div>

          <div>
            <h3
              className={`${jost.className} mb-3 text-xs font-bold uppercase tracking-widest text-gray-500`}
            >
              Address
            </h3>
            <div className="leading-6 text-gray-700">
              <div className="font-semibold text-gray-900">
                Portman Center for Policy Solutions
              </div>
              <div>Clifton Court Hall, University of Cincinnati</div>
              <div>2800 Clifton Avenue</div>
              <div>Cincinnati, OH 45221-0375</div>
            </div>
          </div>

          <div>
            <h3
              className={`${jost.className} mb-3 text-xs font-bold uppercase tracking-widest text-gray-500`}
            >
              Contact Us
            </h3>
            <dl className="space-y-3 text-gray-700">
              <div>
                <dt className="text-gray-600">General inquiries</dt>
                <dd>
                  <a
                    href="mailto:PortmanCenter@uc.edu"
                    className="text-brand hover:underline"
                  >
                    PortmanCenter@uc.edu
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">
                  Student policy internships &amp; careers
                </dt>
                <dd>
                  <a
                    href="mailto:PortmanCareers@uc.edu"
                    className="text-brand hover:underline"
                  >
                    PortmanCareers@uc.edu
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </footer>
  );
}
