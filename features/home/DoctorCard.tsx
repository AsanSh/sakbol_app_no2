"use client";

import { MapPin, Phone, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProfileAvatar } from "@/components/ui/avatar";

export type DoctorCardModel = {
  slug: string;
  name: string;
  image?: string | null;
  specialtyText: string;
  addressText: string;
  phones: string[];
};

type Props = {
  doctor: DoctorCardModel;
  callLabel: string;
  detailsLabel: string;
  noPhoneLabel: string;
  onCall: (doctor: DoctorCardModel) => void;
  onView: (doctor: DoctorCardModel) => void;
};

export function DoctorCard({
  doctor,
  callLabel,
  detailsLabel,
  noPhoneLabel,
  onCall,
  onView,
}: Props) {
  const hasPhone = doctor.phones.length > 0;

  return (
    <Card interactive className="flex min-h-[304px] flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <ProfileAvatar src={doctor.image} name={doctor.name} size={64} className="ring-1 ring-health-border" />
        <div className="min-w-0 space-y-1">
          <h3 className="text-h4 font-semibold text-health-text">{doctor.name}</h3>
          <p className="inline-flex items-center gap-1 text-small text-health-primary">
            <Stethoscope className="h-4 w-4 shrink-0" aria-hidden />
            <span className="line-clamp-2">{doctor.specialtyText}</span>
          </p>
        </div>
      </div>

      <p className="flex items-start gap-2 text-small text-health-text-secondary">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="line-clamp-3">{doctor.addressText}</span>
      </p>

      <p className="text-caption text-health-text-secondary">
        {hasPhone ? doctor.phones[0] : noPhoneLabel}
      </p>

      <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => onView(doctor)}
          aria-label={`${detailsLabel}: ${doctor.name}`}
        >
          {detailsLabel}
        </Button>
        <Button
          type="button"
          variant="primary"
          fullWidth
          disabled={!hasPhone}
          onClick={() => onCall(doctor)}
          aria-label={`${callLabel}: ${doctor.name}`}
        >
          <Phone className="mr-1.5 h-4 w-4" aria-hidden />
          {callLabel}
        </Button>
      </div>
    </Card>
  );
}
